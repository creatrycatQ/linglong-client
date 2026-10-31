// 灵龙电竞 · 打手平台真实 API 客户端与实时通讯管道
// 严格接入 Node.js 平台原生端口 (默认 http://127.0.0.1:3000)

export class LinglongClient {
  constructor() {
    this.baseUrl = localStorage.getItem('ll_api_host') || 'https://www.linglong.club';
    this.user = JSON.parse(localStorage.getItem('ll_user') || 'null');
    this.csrf = localStorage.getItem('ll_csrf') || '';
    this.mockMode = false;
    this.sse = null;
    this.pollTimer = null;
    this.pingTimer = null;
    this.listeners = new Map(); // event -> Set of callbacks
    this.isConnected = false;
    this.latencyMs = -1;
  }

  setBaseUrl(url) {
    if (!url) return;
    this.baseUrl = url.replace(/\/+$/, '');
    localStorage.setItem('ll_api_host', this.baseUrl);
    this.reconnect();
  }

  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(cb);
    return () => this.listeners.get(event)?.delete(cb);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      for (const cb of this.listeners.get(event)) {
        try {
          cb(data);
        } catch (e) {
          console.error(`[LinglongClient] Error in listener for ${event}:`, e);
        }
      }
    }
  }

  setMockMode(enable) {
    this.mockMode = Boolean(enable);
    localStorage.setItem('ll_mock_mode', this.mockMode ? 'true' : 'false');
    if (this.mockMode) {
      this.isConnected = true;
      this.latencyMs = 12;
      this.emit('connection', { connected: true, latency: 12 });
    }
  }

  // 路径门户映射：将内部 API 统一映射至 worker 门户
  portalPath(path) {
    if (path.startsWith('/api/auth/') || path.startsWith('/api/portal/')) return path;
    if (['/api/login', '/api/mfa', '/api/logout'].includes(path)) {
      return '/api/auth/worker/' + path.slice(5);
    }
    return path;
  }

  // 生成唯一幂等操作键
  newOperationKey() {
    return 'desktop-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  }

  // 核心请求封装
  async request(apiPath, options = {}) {
    const fullPath = this.portalPath(apiPath);
    const url = fullPath.startsWith('http') ? fullPath : `${this.baseUrl}${fullPath}`;
    const method = options.method || 'GET';
    const headers = {
      Accept: 'application/json',
      ...(options.headers || {})
    };

    if (options.body && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    if (method !== 'GET') {
      if (this.csrf) headers['X-CSRF-Token'] = this.csrf;
      headers['X-Operation-Key'] = options.key || this.newOperationKey();
    }

    const start = performance.now();
    try {
      const res = await fetch(url, {
        ...options,
        method,
        headers,
        credentials: 'include' // 自动携带 session cookie
      });

      this.latencyMs = Math.round(performance.now() - start);
      this.emit('latency', this.latencyMs);

      if (!res.ok) {
        let errMessage = `HTTP ${res.status}`;
        let errCode = '';
        let details = null;
        try {
          const errData = await res.json();
          errMessage = errData.error || errData.message || errMessage;
          errCode = errData.code || '';
          details = errData.details || null;
        } catch { }

        const error = new Error(errMessage);
        error.status = res.status;
        error.code = errCode;
        error.details = details;

        if (res.status === 401) {
          // 会话失效
          this.user = null;
          this.csrf = '';
          localStorage.removeItem('ll_user');
          localStorage.removeItem('ll_csrf');
          this.emit('auth', null);
        }

        throw error;
      }

      this.isConnected = true;
      const data = await res.json();
      return data;
    } catch (e) {
      if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError') || e.name === 'TypeError') {
        this.isConnected = false;
        this.latencyMs = -1;
        this.emit('connection', { connected: false, error: '无法连接到灵龙服务端 (' + (e.message || '网络连接失败') + ')' });
      }
      throw e;
    }
  }

  // 离线体验与演示 Mock 引擎
  handleMock(apiPath, options = {}) {
    this.isConnected = true;
    this.latencyMs = 12;
    this.emit('latency', 12);
    this.emit('connection', { connected: true, latency: 12 });

    const p = this.portalPath(apiPath);

    if (p.includes('/login') || p.includes('/bootstrap')) {
      return {
        ok: true,
        user: {
          id: 'worker_demo_01',
          username: 'demo_worker',
          nickname: '王牌打手·龙煞',
          avatar_url: './assets/mascot.webp',
          role: 'worker',
          status: 'verified',
          deposit: 2000,
          margin_balance: 5000,
          balance: 18450.50,
          frozen_balance: 650.00,
          credit_score: 100,
          completed_orders: 142,
          rating: 4.98
        },
        csrf: 'mock-csrf-token'
      };
    }

    if (p.includes('page=pool') || p.includes('/pool')) {
      return [
        {
          id: 'ORD-20261031-8841',
          number: 'LL-20261031-8841',
          game: '三角洲行动',
          game_division: 'pc-delta',
          difficulty: '绝密',
          room_kind: 'vip',
          type: 'escort',
          title: '绝密航天基地 · 4级套护航 (保底带出红卡/绝密材料)',
          price: 450.00,
          list_amount: 450.00,
          deposit: 200.00,
          status: 'pending',
          urgent: true,
          estimated_hours: 3,
          customer_name: '夜幕降临 (老板)',
          customer_qq: '381920193',
          room_name: 'VIP天字一号包厢',
          room_password: '888',
          guarantee_text: '包带出至少1张红卡及核心撤离物资，未带出包赔进场成本。',
          slot_offers: [
            { slot: 1, estimated_income: 191.2 },
            { slot: 2, estimated_income: 191.2 }
          ],
          participants: [],
          allow_pair: true,
          created_at: new Date(Date.now() - 720000).toISOString()
        },
        {
          id: 'ORD-20261031-7729',
          number: 'LL-20261031-7729',
          game: '三角洲行动',
          game_division: 'pc-delta',
          difficulty: '机密',
          room_kind: 'normal',
          type: 'escort',
          title: '长弓溪谷机密保金撤离 (已有1打手就位，缺1名突破手)',
          price: 280.00,
          list_amount: 280.00,
          deposit: 100.00,
          status: 'pending',
          urgent: false,
          estimated_hours: 2,
          customer_name: '雷神战队队长',
          customer_qq: '281902812',
          room_name: '二号作战室',
          room_password: '666',
          guarantee_text: '要求熟悉雷达站撤离点，K/D 4.5以上优先。',
          slot_offers: [
            { slot: 1, estimated_income: 119.0 },
            { slot: 2, estimated_income: 119.0 }
          ],
          participants: [{ slot: 1, worker_id: 'w_other' }],
          allow_pair: false,
          created_at: new Date(Date.now() - 320000).toISOString()
        },
        {
          id: 'ORD-20261031-6302',
          number: 'LL-20261031-6302',
          game: '三角洲行动',
          game_division: 'mobile-delta',
          difficulty: '绝密',
          room_kind: 'vip',
          type: 'runner',
          title: '零号大坝绝密飞刀速通 (全程听指挥，极速撤离)',
          price: 360.00,
          list_amount: 360.00,
          deposit: 150.00,
          status: 'pending',
          urgent: false,
          estimated_hours: 2,
          customer_name: '快乐小熊猫',
          customer_qq: '492019283',
          room_name: '手游专属一号房',
          room_password: '520',
          guarantee_text: '专精身法与摸金，全程开麦报点。',
          slot_offers: [
            { slot: 1, estimated_income: 153.0 },
            { slot: 2, estimated_income: 153.0 }
          ],
          participants: [],
          allow_pair: true,
          created_at: new Date(Date.now() - 150000).toISOString()
        },
        {
          id: 'ORD-20261031-5190',
          number: 'LL-20261031-5190',
          game: '三角洲行动',
          game_division: 'pc-delta',
          difficulty: '常规',
          room_kind: 'normal',
          type: 'fun',
          title: '巴克什战区娱乐陪练 (连麦聊天欢快局，保K/D体验)',
          price: 180.00,
          list_amount: 180.00,
          deposit: 80.00,
          status: 'pending',
          urgent: false,
          estimated_hours: 2,
          customer_name: '微风拂柳',
          customer_qq: '192837465',
          room_name: '娱乐聊天包厢',
          room_password: '123',
          guarantee_text: '态度温和包容，拒绝压力怪。',
          slot_offers: [
            { slot: 1, estimated_income: 76.5 }
          ],
          participants: [],
          allow_pair: false,
          created_at: new Date(Date.now() - 85000).toISOString()
        }
      ];
    }

    if (p.includes('/dashboard') || p.includes('page=overview') || p.includes('/state')) {
      return {
        workerOrders: [
          {
            id: 'ORD-20261031-9012',
            number: 'LL-20261031-091',
            title: '绝密航天基地 · 4级套护送带出红卡',
            difficulty: '绝密',
            map_name: '航天基地',
            game_division: 'pc-delta',
            status: 'in_progress',
            list_amount: 320.00,
            my_share_income: 272.00,
            customer_name: '黑夜行者 (老板)',
            customer_qq: '392817291',
            room_name: 'VIP天字一号包厢',
            room_password: '886',
            guarantee_text: '包带出至少1张红卡及核心物资，未带出包赔进场成本。',
            created_at: new Date(Date.now() - 3600000).toISOString()
          },
          {
            id: 'ORD-20261030-3810',
            number: 'LL-20261030-044',
            title: '长弓溪谷 · 娱乐摸金单',
            difficulty: '常规',
            map_name: '长弓溪谷',
            game_division: 'pc-delta',
            status: 'completed',
            list_amount: 180.00,
            my_share_income: 153.00,
            customer_name: '快乐小熊猫',
            customer_qq: '281920192',
            settled_at: '2026-10-30 21:40',
            created_at: new Date(Date.now() - 86400000).toISOString()
          }
        ],
        income: {
          earned: 18450.50,
          available: 5280.00,
          frozen: 650.00,
          pending: 320.00,
          completed: 142
        },
        ledger: [
          { id: 'TX-1092', type: 'order_settle', order_number: 'LL-20261030-044', amount: 153.00, balance_after: 5280.00, created_at: '2026-10-30 21:42:10', note: '完成订单【长弓溪谷·娱乐摸金单】结算' },
          { id: 'TX-1091', type: 'withdraw', order_number: 'W-902', amount: -3000.00, balance_after: 5127.00, created_at: '2026-10-28 14:22:00', note: '微信零钱提现到账' },
          { id: 'TX-1090', type: 'order_settle', order_number: 'LL-20261028-012', amount: 425.00, balance_after: 8127.00, created_at: '2026-10-28 12:10:00', note: '完成订单【航天基地双人护航】结算' }
        ],
        withdrawals: [
          { id: 'W-902', amount: 3000.00, status: 'completed', status_text: '已到账', account_type: '微信支付', account_name: '微信零钱 (wxid_...88)', created_at: '2026-10-28 14:20:00' },
          { id: 'W-901', amount: 5000.00, status: 'completed', status_text: '已到账', account_type: '支付宝', account_name: '支付宝 (138****9988)', created_at: '2026-10-22 10:15:00' }
        ],
        rating: {
          average_stars: 4.98,
          review_count: 142,
          positive_count: 140
        },
        reviews: [
          { customer: '老板_****89', stars: 5, tags: ['枪法极硬', '态度极好', '撤离神速'], comment: '打手非常稳，航天基地直接杀穿带我拿到两张红卡，强烈推荐！', created_at: '2026-10-30 22:00' },
          { customer: '战神****01', stars: 5, tags: ['意识超前', '指挥清晰'], comment: '车队指挥非常到位，听指挥直接躺赢。', created_at: '2026-10-29 18:30' }
        ],
        receivedTips: [
          { customer: '老板_****89', amount: 88.00, message: '打得漂亮，请喝咖啡！', created_at: '2026-10-30 22:01' }
        ]
      };
    }

    if (p.includes('/join') || p.includes('/pair')) {
      return { ok: true, message: '抢单成功！已转入履约流程' };
    }
    if (p.includes('/complete')) {
      return { ok: true, message: '结单申请已提交客服审核' };
    }
    if (p.includes('/transfer')) {
      return { ok: true, message: '转单申请已发布至公共转单池' };
    }
    if (p.includes('/leave')) {
      return { ok: true, message: '已放弃该履约单' };
    }
    if (p.includes('/withdrawals')) {
      return { ok: true, message: '提现申请已受理，款项预计2小时内到账' };
    }

    return { ok: true };
  }

  // 单独获取控制台统计与订单
  async getDashboard() {
    return await this.request('/api/dashboard');
  }

  // 健康检测与延迟测速
  async ping() {
    if (this.mockMode) {
      this.latencyMs = 12;
      this.isConnected = true;
      this.emit('connection', { connected: true, latency: 12 });
      return { ok: true, latency: 12 };
    }

    const start = performance.now();
    try {
      const res = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET',
        cache: 'no-store'
      });
      if (res.ok) {
        const cost = Math.round(performance.now() - start);
        this.latencyMs = cost;
        this.isConnected = true;
        this.emit('latency', cost);
        this.emit('connection', { connected: true, latency: cost });
        return { ok: true, latency: cost };
      }
    } catch (e) {
      this.isConnected = false;
      this.latencyMs = -1;
      this.emit('connection', { connected: false, error: e.message });
      return { ok: false, error: e.message };
    }
    return { ok: false };
  }

  // 打手登录 (POST /api/auth/worker/login)
  async login(username, password) {
    const data = await this.request('/api/auth/worker/login', {
      method: 'POST',
      body: { username, password }
    });

    this.user = data.user;
    this.csrf = data.csrf;
    localStorage.setItem('ll_user', JSON.stringify(this.user));
    localStorage.setItem('ll_csrf', this.csrf);
    this.emit('auth', this.user);
    this.startRealtime();
    return data;
  }

  // 登出 (POST /api/auth/worker/logout)
  async logout() {
    try {
      await this.request('/api/auth/worker/logout', { method: 'POST', body: {} });
    } catch { }
    this.user = null;
    this.csrf = '';
    localStorage.removeItem('ll_user');
    localStorage.removeItem('ll_csrf');
    this.stopRealtime();
    this.emit('auth', null);
  }

  // 初始化鉴权信息 (GET /api/portal/worker/bootstrap)
  async bootstrap() {
    const data = await this.request('/api/bootstrap');
    if (data.user) {
      this.user = data.user;
      this.csrf = data.csrf || this.csrf;
      localStorage.setItem('ll_user', JSON.stringify(this.user));
      localStorage.setItem('ll_csrf', this.csrf);
      this.emit('auth', this.user);
    } else {
      this.user = null;
      this.csrf = '';
      localStorage.removeItem('ll_user');
      localStorage.removeItem('ll_csrf');
      this.emit('auth', null);
    }
    return data;
  }

  // 获取打手完整状态视图 (GET /api/portal/worker/state)
  async getState(page = 'overview', known = '') {
    const q = new URLSearchParams({
      mode: 'worker',
      page: page,
      known: known
    });
    return await this.request(`/api/state?${q.toString()}`);
  }

  // 单独获取抢单大厅
  async getPool() {
    return await this.request('/api/pool');
  }

  // 单人接单 / 抢单
  async joinOrder(orderId, slot = null) {
    return await this.request(`/api/orders/${orderId}/join`, {
      method: 'POST',
      body: slot ? { slot: Number(slot) } : {}
    });
  }

  // 双人接单 / 携带搭档
  async pairOrder(orderId, partnerId) {
    return await this.request(`/api/orders/${orderId}/pair`, {
      method: 'POST',
      body: { partner_id: partnerId }
    });
  }

  // 获取搭档候选人列表
  async getCandidates(orderId, purpose = 'pair') {
    return await this.request(`/api/orders/${orderId}/candidates?purpose=${purpose}`);
  }

  // 放弃/退出订单
  async leaveOrder(orderId, version = 1, reason = '打手自主放弃') {
    return await this.request(`/api/orders/${orderId}/leave`, {
      method: 'POST',
      body: { id: orderId, version: Number(version), reason }
    });
  }

  // 发起转单
  async transferOrder(orderId, { to_id, completion_bps = 0, note = '', version = 1 }) {
    return await this.request(`/api/orders/${orderId}/transfer`, {
      method: 'POST',
      body: { id: orderId, version: Number(version), to_id, completion_bps: Number(completion_bps), note }
    });
  }

  // 结单提交 (申请客服审核)
  async completeOrder(orderId, { version = 1, confirmed = true, reason = '服务已圆满完成' } = {}) {
    return await this.request(`/api/orders/${orderId}/complete`, {
      method: 'POST',
      body: { id: orderId, version: Number(version), confirmed: true, reason }
    });
  }

  // 上传图片 (结单截图、头像、收款码)
  // kind: 'proof' | 'avatar' | 'qrcode'
  async uploadFile({ kind, data, order_id = null, title = '' }) {
    return await this.request('/api/files', {
      method: 'POST',
      body: {
        kind,
        data,
        order_id,
        title: title || (kind === 'proof' ? '结单结算凭证' : kind === 'qrcode' ? '微信/支付宝收款码' : '打手头像')
      }
    });
  }

  // 申请提现 (金额以分计，100元 = 10000)
  async applyWithdrawal(amountYuan, qrcodeId) {
    const amountCents = Math.round(parseFloat(amountYuan) * 100);
    return await this.request('/api/withdrawals', {
      method: 'POST',
      body: {
        amount: amountCents,
        qrcode_id: qrcodeId
      }
    });
  }

  // 更新个人资料
  async updateProfile({ nickname, qq, phone, intro }) {
    return await this.request('/api/profile', {
      method: 'POST',
      body: { nickname, qq, phone, intro }
    });
  }

  // 获取打手须知
  async getWorkerNotice() {
    if (this._noticePromise) return await this._noticePromise;
    this._noticePromise = (async () => {
      try {
        return await this.request('/api/worker-notice');
      } finally {
        this._noticePromise = null;
      }
    })();
    return await this._noticePromise;
  }

  // 标记打手须知已读至末尾
  async markWorkerNoticeRead(readToken) {
    return await this.request('/api/worker-notice/read', {
      method: 'POST',
      body: {
        read_token: readToken,
        read_to_end: true
      }
    });
  }

  // 签署打手须知
  async acceptWorkerNotice(readToken, confirmation, adultConfirmation) {
    return await this.request('/api/worker-notice/accept', {
      method: 'POST',
      body: {
        read_token: readToken,
        confirmation,
        adult_confirmation: adultConfirmation
      }
    });
  }

  // 标记单条通知已读
  async readNotification(id) {
    return await this.request(`/api/notifications/${id}/read`, {
      method: 'POST',
      body: {}
    });
  }

  // 标记所有通知已读
  async readAllNotifications() {
    return await this.request('/api/notifications/read-all', {
      method: 'POST',
      body: {}
    });
  }

  // 检查客户端更新
  async checkUpdate() {
    try {
      const res = await this.request('/api/client/update', { timeout: 6000 });
      if (res && res.ok) {
        return res;
      }
    } catch (e) {
      console.warn('[LinglongClient] /api/client/update request failed, fallback to health:', e);
    }

    // 备用兜底：请求 /api/health 获取版本号
    try {
      const health = await this.request('/api/health', { timeout: 4000 });
      return {
        ok: true,
        client_version: '1.0.2',
        server_version: health.version || '4.0.0',
        changelog: ['常规性能调优与体验优化'],
        download_url: 'https://www.linglong.club',
        force_update: false
      };
    } catch (err) {
      throw new Error('无法连接到更新服务器，请检查网络连接');
    }
  }

  // 启动实时更新流 (SSE + 心跳探活)
  startRealtime() {
    this.stopRealtime();

    if (this.mockMode) {
      this.isConnected = true;
      this.latencyMs = 12;
      this.emit('connection', { connected: true, latency: 12 });
      return;
    }

    const connectSSE = () => {
      if (!this.user) return;
      const sseUrl = `${this.baseUrl}/api/portal/worker/events`;
      try {
        this.sse = new EventSource(sseUrl, { withCredentials: true });

        this.sse.onopen = () => {
          this.isConnected = true;
          this.emit('connection', { connected: true, latency: this.latencyMs });
        };

        this.sse.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            this.emit('revision', payload);
            this.emit('refresh');
          } catch { }
        };

        this.sse.onerror = () => {
          this.isConnected = false;
          this.emit('connection', { connected: false });
          if (this.sse) {
            this.sse.close();
            this.sse = null;
          }
        };
      } catch (e) {
        console.warn('[LinglongClient] SSE setup error:', e);
      }
    };

    connectSSE();

    // 备用保活心跳与网络延迟巡检 (每 5 秒)
    this.pingTimer = setInterval(async () => {
      await this.ping();
      if (!this.sse || this.sse.readyState === EventSource.CLOSED) {
        connectSSE();
      }
    }, 5000);
  }

  stopRealtime() {
    if (this.sse) {
      this.sse.close();
      this.sse = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  reconnect() {
    this.stopRealtime();
    if (this.user) {
      this.startRealtime();
    }
    this.ping();
  }
}

export const api = new LinglongClient();
