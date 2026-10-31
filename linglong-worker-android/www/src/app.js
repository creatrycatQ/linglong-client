// 灵龙电竞 · Windows 原生打手接单客户端核心控制器
// 美术框架遵循 FLCLASH_UI_FRAMEWORK.md (FlClash 四级表面深度 + 流体玻璃 + 连续曲率超椭圆)

import { api } from './api.js';
import { SoundEngine, SOUND_PROFILES, SPEECH_SCHEMES } from './audio.js';

export const CLIENT_VERSION = '1.0.2';

// 初始化音频引擎
const soundEngine = new SoundEngine();

// 状态管理
const state = {
  currentPage: 'pool',
  user: null,
  poolOrders: [],
  knownOrderIds: new Set(),
  dashboardData: null,
  notice: null,
  noticeRead: false,
  noticeReadPending: false,
  poolFilter: 'all',
  ordersFilter: 'all',
  timerInterval: null,
  windowPinned: false,
  soundMuted: !soundEngine.enabled,
  autoUpdateEnabled: localStorage.getItem('ll_auto_update') !== 'false',
  updateChecking: false,
  latestUpdateInfo: null,
  lastKnownPoolCount: 0
};

// 页面加载入口
window.addEventListener('DOMContentLoaded', () => {
  setupElectronBridges();
  setupEventListeners();
  setupApiListeners();
  initApplication();
});

/* ========================================================
   1. Electron 窗口与系统托盘桥接
   ======================================================== */
function setupElectronBridges() {
  const electron = window.electronAPI;

  const btnMin = document.getElementById('btn-window-min');
  const btnMax = document.getElementById('btn-window-max');
  const btnClose = document.getElementById('btn-window-close');
  const btnPin = document.getElementById('btn-window-pin');
  const btnAudio = document.getElementById('btn-audio-toggle');

  if (electron) {
    btnMin?.addEventListener('click', () => electron.minimize());
    btnMax?.addEventListener('click', () => electron.toggleMaximize());
    btnClose?.addEventListener('click', () => electron.close());

    btnPin?.addEventListener('click', () => {
      state.windowPinned = !state.windowPinned;
      electron.togglePin(state.windowPinned);
      btnPin.classList.toggle('active', state.windowPinned);
      btnPin.classList.toggle('pinned', state.windowPinned);
      showToast(state.windowPinned ? '已开启窗口置顶' : '已取消窗口置顶', 'info');
    });

    electron.onMaximizedChange((isMax) => {
      if (btnMax) {
        btnMax.textContent = isMax ? '❐' : '□';
        btnMax.title = isMax ? '向下还原' : '最大化';
      }
    });

    electron.onNavGoto((page) => {
      navigateTo(page);
    });
  } else {
    // 纯浏览器预览模式下的兼容处理
    console.info('[Desktop] Running in standalone web preview mode');
  }

  // 声音/静音快捷切换
  btnAudio?.addEventListener('click', () => {
    const isEnabled = soundEngine.toggleSound();
    state.soundMuted = !isEnabled;
    updateAudioButtonUI();
    showToast(isEnabled ? '抢单提示音已开启' : '抢单提示音已静音', isEnabled ? 'success' : 'info');
  });

  updateAudioButtonUI();
}

function updateAudioButtonUI() {
  const btnAudio = document.getElementById('btn-audio-toggle');
  if (!btnAudio) return;
  if (soundEngine.enabled) {
    btnAudio.textContent = '🔊';
    btnAudio.title = '抢单提示音：已开启 (点击静音)';
    btnAudio.classList.remove('muted');
  } else {
    btnAudio.textContent = '🔇';
    btnAudio.title = '抢单提示音：已静音 (点击开启)';
    btnAudio.classList.add('muted');
  }
}

/* ========================================================
   2. 全局事件与导航绑定
   ======================================================== */
function setupEventListeners() {
  // 侧边栏导航点击
  const navItems = document.querySelectorAll('.nav-item[data-page]');
  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      const page = item.getAttribute('data-page');
      navigateTo(page);
    });
  });

  // 移动端底部导航栏点击
  document.querySelectorAll('.bottom-tab-item[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const page = btn.getAttribute('data-page');
      if (page === 'more') {
        openDrawer();
      } else {
        closeDrawer();
        navigateTo(page);
      }
    });
  });

  // 移动端抽屉控制
  function openDrawer() {
    const overlay = document.getElementById('mobile-drawer-overlay');
    if (overlay) overlay.style.display = 'flex';
  }
  function closeDrawer() {
    const overlay = document.getElementById('mobile-drawer-overlay');
    if (overlay) overlay.style.display = 'none';
  }
  document.getElementById('btn-close-drawer')?.addEventListener('click', closeDrawer);
  document.getElementById('mobile-drawer-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'mobile-drawer-overlay') closeDrawer();
  });
  document.querySelectorAll('[data-drawer-nav]').forEach((el) => {
    el.addEventListener('click', () => {
      const target = el.getAttribute('data-drawer-nav');
      closeDrawer();
      navigateTo(target);
    });
  });
  document.getElementById('btn-drawer-logout')?.addEventListener('click', () => {
    closeDrawer();
    document.getElementById('btn-logout')?.click();
  });

  // 移动端顶部头像点击
  document.getElementById('mobile-user-badge')?.addEventListener('click', () => {
    if (!state.user) {
      showLoginModal();
    } else {
      navigateTo('profile');
    }
  });

  // 首次触摸初始化 AudioContext
  document.addEventListener('touchstart', () => soundEngine.initContext(), { once: true });
  document.addEventListener('click', () => soundEngine.initContext(), { once: true });

  // 侧边栏头像/名片点击 -> 切换至个人资料
  document.getElementById('worker-profile-card')?.addEventListener('click', () => {
    if (!state.user) {
      showLoginModal();
    } else {
      navigateTo('profile');
    }
  });

  // 退出登录
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    if (!state.user) {
      showLoginModal();
      return;
    }
    showConfirmModal({
      title: '确认退出客户端登录？',
      body: '<p style="color:var(--text-muted);font-size:13px;">退出后将暂停接单状态与语音播报通知，重新登录可恢复。</p>',
      confirmText: '退出登录',
      onConfirm: async () => {
        try {
          await api.logout();
        } catch {}
        window.electronAPI?.clearSessionCookie?.();
        state.user = null;
        state.poolOrders = [];
        state.dashboardData = null;
        state.notice = null;
        state.noticeRead = false;
        state.noticeReadPending = false;
        updateSidebarUser();
        updateBadges();
        navigateTo('pool');
        showToast('已安全退出登录', 'info');
        showLoginModal();
      }
    });
  });

  // 模态弹窗系统通用关闭
  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
  document.getElementById('modal-cancel-btn')?.addEventListener('click', closeModal);
  document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });

  // 每秒刷新一次时间推移（接单大厅订单已等待时间）
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    updateElapsedTimers();
  }, 1000);
}

/* ========================================================
   3. API 实时连接与网络状态同步
   ======================================================== */
function setupApiListeners() {
  const statusPill = document.getElementById('connection-status-pill');
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const statusLatency = document.getElementById('status-latency');
  const footerHostLabel = document.getElementById('footer-host-label');

  if (footerHostLabel) {
    try {
      const hostUrl = new URL(api.baseUrl);
      footerHostLabel.textContent = hostUrl.port || (hostUrl.protocol === 'https:' ? '443' : '80');
    } catch {
      footerHostLabel.textContent = '3000';
    }
  }

  api.on('connection', ({ connected, error }) => {
    if (connected) {
      statusDot?.classList.remove('offline');
      statusDot?.classList.add('online');
      if (statusText) statusText.textContent = api.mockMode ? '演示离线模式' : '已连接灵龙服务';
    } else {
      statusDot?.classList.remove('online');
      statusDot?.classList.add('offline');
      if (statusText) statusText.textContent = '服务离线 / 重连中';
    }
  });

  api.on('latency', (ms) => {
    if (statusLatency) {
      statusLatency.style.display = 'inline';
      statusLatency.textContent = `${ms}ms`;
      if (ms > 300) statusLatency.style.color = 'var(--danger)';
      else if (ms > 120) statusLatency.style.color = 'var(--warning)';
      else statusLatency.style.color = 'var(--success)';
    }
  });

  api.on('auth', (user) => {
    state.user = user;
    updateSidebarUser();
  });

  // 监听来自 SSE 的实时事件
  api.on('refresh', () => {
    console.log('[SSE] Refresh event received');
    refreshData(true);
  });

  api.on('poll', () => {
    if (state.user && !api.mockMode) {
      refreshData(true);
    }
  });
}

/* ========================================================
   4. 应用初始化与更新检测
   ======================================================== */
async function initApplication() {
  // 启动服务健康检测与网络延迟探测
  api.ping();
  setInterval(() => api.ping(), 20000);

  if (api.user) {
    state.user = api.user;
    updateSidebarUser();
    api.startRealtime();
    await refreshData();
    navigateTo('pool');
  } else {
    updateSidebarUser();
    navigateTo('pool');
    setTimeout(() => {
      showLoginModal();
    }, 150);
  }

  // 启动时自动检测更新 (非阻塞静默运行)
  if (state.autoUpdateEnabled) {
    setTimeout(() => {
      checkAppUpdate(true);
    }, 2800);
  }
}

// 检查客户端更新
async function checkAppUpdate(silent = false) {
  if (state.updateChecking) return;
  state.updateChecking = true;

  try {
    const updateInfo = await api.checkUpdate();
    state.latestUpdateInfo = updateInfo;

    const remoteVer = updateInfo.client_version || '1.0.0';
    const isNewer = compareVersions(remoteVer, CLIENT_VERSION) > 0;

    if (isNewer) {
      if (silent) {
        showToast(`发现新版本客户端 (v${remoteVer})，可在设置中心查阅并升级`, 'info');
      } else {
        showUpdateDialog(updateInfo);
      }
    } else {
      if (!silent) {
        showToast(`当前客户端已是最新版本 (v${CLIENT_VERSION})`, 'success');
      }
    }
  } catch (err) {
    if (!silent) {
      showToast(err.message || '检测更新失败，请检查网络连接', 'error');
    }
  } finally {
    state.updateChecking = false;
    if (state.currentPage === 'settings') {
      renderSettingsView();
    }
  }
}

// 版本号大小比对
function compareVersions(v1, v2) {
  const p1 = (v1 || '0').split('.').map(Number);
  const p2 = (v2 || '0').split('.').map(Number);
  const len = Math.max(p1.length, p2.length);
  for (let i = 0; i < len; i++) {
    const n1 = p1[i] || 0;
    const n2 = p2[i] || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
}

// 展示新版本更新日志对话框
function showUpdateDialog(updateInfo) {
  const changelogHtml = (updateInfo.changelog || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');

  showConfirmModal({
    title: `🚀 发现新版本客户端 (v${updateInfo.client_version})`,
    body: `
      <div style="display:flex; flex-direction:column; gap:12px; text-align:left;">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
          <span style="font-size:14px; font-weight:700; color:#fff;">${escapeHtml(updateInfo.title || '灵龙接单助手最新版')}</span>
          <span class="pill-badge vip" style="font-size:11px;">发布日期: ${escapeHtml(updateInfo.release_date || '2026-10-31')}</span>
        </div>
        <div style="font-size:12px; color:var(--text-muted);">
          新版本包含以下功能更新与体验优化：
        </div>
        <div style="background:var(--surface-inset); border:1px solid var(--line-subtle); border-radius:var(--radius-md); padding:14px 18px; max-height:220px; overflow-y:auto;">
          <ul class="update-changelog-list" style="margin:0;">
            ${changelogHtml || '<li>常规体验优化与性能改进</li>'}
          </ul>
        </div>
        <div style="font-size:11px; color:var(--text-dim); line-height:1.5;">
          提示：点击下方“立即获取新版本”将打开官方平台下载页面获取最新安装包。
        </div>
      </div>
    `,
    confirmText: '🚀 立即获取新版本',
    cancelText: '稍后提醒',
    onConfirm: () => {
      closeModal();
      const url = updateInfo.download_url || 'https://www.linglong.club';
      window.electronAPI?.openExternal(url);
    }
  });
}

// 刷新接单大厅与打手看板数据 (带并发互斥防抖)
let isRefreshing = false;
async function refreshData(silent = false) {
  if (isRefreshing) return;
  isRefreshing = true;
  try {
    const pPool = api.getPool();
    const pDash = state.user ? api.getDashboard() : Promise.resolve(null);
    const pNotice = (state.user && !state.notice) ? api.getWorkerNotice() : Promise.resolve(null);

    const [poolRes, dashRes, noticeRes] = await Promise.allSettled([pPool, pDash, pNotice]);

    if (poolRes && poolRes.status === 'fulfilled' && poolRes.value) {
      const list = Array.isArray(poolRes.value)
        ? poolRes.value
        : (Array.isArray(poolRes.value.pool) ? poolRes.value.pool : []);
      handlePoolUpdate(list, silent);
    }

    if (dashRes && dashRes.status === 'fulfilled' && dashRes.value) {
      state.dashboardData = dashRes.value;
      updateBadges();
      if (['active', 'orders', 'history', 'ledger', 'profile'].includes(state.currentPage)) {
        renderCurrentPage();
      }
    }

    if (noticeRes && noticeRes.status === 'fulfilled' && noticeRes.value) {
      if (state.notice && !state.notice.accepted && state.notice.read_token && state.notice.version === noticeRes.value.version) {
        state.notice = { ...noticeRes.value, read_token: state.notice.read_token };
      } else {
        state.notice = noticeRes.value;
      }
      updateBadges();
      if (state.currentPage === 'notice' || (state.currentPage === 'pool' && state.notice.accepted === false)) {
        renderCurrentPage();
      }
    }
  } catch (e) {
    if (!silent) console.error('Failed to refresh data:', e);
  } finally {
    isRefreshing = false;
  }
}

// 处理接单大厅更新与新订单提醒
function handlePoolUpdate(newOrders, silent = false) {
  const previousIds = state.knownOrderIds;
  const currentIds = new Set(newOrders.map((o) => o.id));

  // 检查是否有全新发布的订单
  let hasNewOrders = false;
  let latestNewOrder = null;

  for (const o of newOrders) {
    if (!previousIds.has(o.id)) {
      hasNewOrders = true;
      latestNewOrder = o;
    }
  }

  state.poolOrders = newOrders;
  state.knownOrderIds = currentIds;
  updateBadges();

  if (hasNewOrders && previousIds.size > 0 && !silent) {
    // 触发自定义来单提示音
    soundEngine.playOrderPings();

    // 触发指名专属订单 TTS 语音播报 或 普通来单播报
    if (latestNewOrder) {
      const isNominated = latestNewOrder.nominated === 1 || (Array.isArray(latestNewOrder.named_workers) && latestNewOrder.named_workers.length > 0);

      if (isNominated && soundEngine.speechDesignated) {
        soundEngine.speakDesignatedOrder(latestNewOrder, state.user);
      } else if (soundEngine.speechGeneral) {
        const speechMsg = `灵龙电竞接单大厅新发布${latestNewOrder.difficulty || '绝密'}订单，预期收益${latestNewOrder.slot_offers?.[0]?.estimated_income || latestNewOrder.list_amount}元`;
        soundEngine.speak(speechMsg);
      }

      // 触发 Windows 桌面系统通知
      const notifyTitle = isNominated ? '【灵龙电竞】收到指名专属订单！' : '【灵龙电竞】新发布接单通知';
      window.electronAPI?.notify(
        notifyTitle,
        `${latestNewOrder.title} · 标价 ¥${latestNewOrder.list_amount} · ${latestNewOrder.map_name || '绝密地图'}`
      );
    }
  }

  if (state.currentPage === 'pool') {
    renderPoolView();
  }
}

// 更新侧边栏打手资料与未读角标
function updateSidebarUser() {
  const avatar = document.getElementById('sidebar-avatar');
  const name = document.getElementById('sidebar-name');
  const level = document.getElementById('sidebar-level');
  const stars = document.getElementById('sidebar-stars');

  const mAvatar = document.querySelector('.mobile-user-avatar');
  const mName = document.querySelector('.mobile-user-name');
  const drawerLogout = document.getElementById('btn-drawer-logout');

  if (state.user) {
    if (name) name.textContent = state.user.nickname || state.user.username;
    if (mName) mName.textContent = state.user.nickname || state.user.username;
    if (level) {
      level.textContent = `Lv.${state.user.worker_level || 5} 灵龙认证打手`;
      level.style.display = 'inline-block';
    }
    if (stars) {
      const avg = state.dashboardData?.rating?.average_stars || 4.96;
      stars.textContent = `⭐ ${avg.toFixed(2)}`;
      stars.style.display = 'block';
    }
    if (avatar) avatar.src = './assets/mascot.webp';
    if (mAvatar) mAvatar.src = './assets/mascot.webp';
    if (drawerLogout) drawerLogout.style.display = 'flex';
  } else {
    if (name) name.textContent = '点击登录客户端';
    if (mName) mName.textContent = '登录';
    if (level) level.style.display = 'none';
    if (stars) stars.style.display = 'none';
    if (avatar) avatar.src = './assets/brand.webp';
    if (mAvatar) mAvatar.src = './assets/brand.webp';
    if (drawerLogout) drawerLogout.style.display = 'none';
  }

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.style.display = state.user ? 'flex' : 'none';
  }

  updateBadges();
}

function updateBadges() {
  const badgePool = document.getElementById('badge-pool');
  const badgeActive = document.getElementById('badge-active');

  const poolCount = state.poolOrders.length;
  if (badgePool) {
    badgePool.textContent = poolCount;
    badgePool.style.display = poolCount > 0 ? 'inline-block' : 'none';
  }

  const activeOrders = (state.dashboardData?.workerOrders || []).filter(
    (o) => o.status === 'matched' || o.status === 'in_progress'
  );
  if (badgeActive) {
    badgeActive.textContent = activeOrders.length;
    badgeActive.style.display = activeOrders.length > 0 ? 'inline-block' : 'none';
  }

  const allOrdersCount = (state.dashboardData?.workerOrders || []).length;
  const badgeOrders = document.getElementById('badge-orders');
  if (badgeOrders) {
    badgeOrders.textContent = allOrdersCount;
    badgeOrders.style.display = allOrdersCount > 0 ? 'inline-block' : 'none';
  }

  const badgeNotice = document.getElementById('badge-notice');
  const drawerNotice = document.getElementById('drawer-badge-notice');
  const mBadgeDot = document.getElementById('mobile-badge-dot');

  if (badgeNotice) {
    if (!state.user || !state.notice) {
      badgeNotice.style.display = 'none';
      if (drawerNotice) drawerNotice.style.display = 'none';
      if (mBadgeDot) mBadgeDot.style.display = 'none';
    } else if (state.notice.accepted === false) {
      badgeNotice.style.display = 'inline-block';
      badgeNotice.textContent = '待确认';
      badgeNotice.style.background = 'var(--warning)';
      badgeNotice.style.color = '#000';
      badgeNotice.style.fontWeight = '700';
      if (drawerNotice) {
        drawerNotice.style.display = 'inline-block';
        drawerNotice.textContent = '待确认';
        drawerNotice.style.background = 'var(--warning)';
        drawerNotice.style.color = '#000';
      }
      if (mBadgeDot) mBadgeDot.style.display = 'block';
    } else {
      badgeNotice.style.display = 'inline-block';
      badgeNotice.textContent = '已签署';
      badgeNotice.style.background = 'rgba(16, 185, 129, 0.2)';
      badgeNotice.style.color = 'var(--success)';
      badgeNotice.style.fontWeight = '600';
      if (drawerNotice) {
        drawerNotice.style.display = 'inline-block';
        drawerNotice.textContent = '已签署';
        drawerNotice.style.background = 'rgba(16, 185, 129, 0.2)';
        drawerNotice.style.color = 'var(--success)';
      }
      if (mBadgeDot) mBadgeDot.style.display = 'none';
    }
  }

  // 移动端底部红点与数字更新
  const mBadgePool = document.getElementById('mobile-badge-pool');
  if (mBadgePool) {
    mBadgePool.textContent = poolCount;
    mBadgePool.style.display = poolCount > 0 ? 'flex' : 'none';
  }

  const mBadgeActive = document.getElementById('mobile-badge-active');
  if (mBadgeActive) {
    mBadgeActive.textContent = activeOrders.length;
    mBadgeActive.style.display = activeOrders.length > 0 ? 'flex' : 'none';
  }
}

/* ========================================================
   5. 路由与主视图渲染控制
   ======================================================== */
function navigateTo(page) {
  state.currentPage = page;

  // 更新导航激活状态
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.getAttribute('data-page') === page);
  });

  // 更新移动端底部栏激活状态
  document.querySelectorAll('.bottom-tab-item').forEach((item) => {
    item.classList.toggle('active', item.getAttribute('data-page') === page);
  });

  renderCurrentPage();
}

function renderCurrentPage() {
  const container = document.getElementById('main-view-container');
  if (!container) return;

  switch (state.currentPage) {
    case 'pool':
      renderPoolView();
      break;
    case 'active':
      renderActiveOrdersView();
      break;
    case 'orders':
    case 'all-orders':
    case 'history':
      renderAllOrdersView();
      break;
    case 'ledger':
      renderLedgerView();
      break;
    case 'profile':
      renderProfileView();
      break;
    case 'notice':
      renderNoticeView();
      break;
    case 'settings':
      renderSettingsView();
      break;
    default:
      renderPoolView();
  }
}

/* ========================================================
   6. 基础业务字典与对齐工具 (Server-Aligned Domain Helpers)
   ======================================================== */
const DIVISIONS = [
  { id: 'pc-delta', name: 'PC三角洲' },
  { id: 'mobile-delta', name: '手游三角洲' },
  { id: 'honor', name: '王者荣耀' },
  { id: 'apex', name: 'APEX' }
];

function getDivisionName(id) {
  return DIVISIONS.find((d) => d.id === id)?.name || (id === 'mobile-delta' ? '手游三角洲' : 'PC三角洲');
}

const TYPE_NAMES = {
  fun: '趣味单',
  companion: '陪玩单',
  escort: '护航单',
  experience: '体验单',
  tip: '打赏/罚款',
  fine: '打赏/罚款'
};

function getTypeName(order) {
  if (order.service_rule === 'runner' || (order.title && order.title.includes('跑刀'))) return '跑刀单';
  return TYPE_NAMES[order.type] || order.type || '护航单';
}

const STATUS_NAMES = {
  open: '待接单',
  matching: '组队中',
  matched: '进行中',
  service: '进行中',
  review: '待确认完成',
  frozen: '冻结中',
  completed: '已完成',
  exception: '进行中',
  cancelled: '订单取消',
  pending: '待处理',
  approved: '正常',
  rejected: '已退回',
  suspended: '限制接单',
  none: '普通账号',
  paid: '已结算',
  split: '已转为子订单',
  transferred: '已转单'
};

function getStatusName(status) {
  return STATUS_NAMES[status] || status || '待接单';
}

const RANK_NAMES = ['娱乐', '技术', '精英', '顶尖', '魔王', '明星魔王', '明星魔王PRO', '跑刀'];
function getRankLabel(level = 0, division = 'pc-delta') {
  const n = Math.max(0, Math.min(7, Number(level) || 0));
  const divPrefix = division === 'pc-delta' ? 'PC' : division === 'mobile-delta' ? '手游' : getDivisionName(division);
  return `${divPrefix}-${RANK_NAMES[n]}`;
}

function formatYuan(cents) {
  if (cents == null || isNaN(cents)) return '0.00';
  return (Number(cents) / 100).toFixed(2);
}

const OOPZ_CHANNEL = '548025338';

function getRoomInfo(order) {
  if (order.game_division === 'mobile-delta') {
    return {
      type: 'mobile',
      label: '手游好友码',
      value: order.friend_code ? String(order.friend_code) : '接单后由老板提供',
      password: '',
      hint: '本单不分配语音房间，通过游戏好友码组队'
    };
  }
  if (order.room_name) {
    const isVip = order.room_kind === 'vip';
    const pwd = order.room_password || (Number.isInteger(order.room_number) ? '111' + order.room_number : '');
    return {
      type: 'room',
      label: isVip ? 'VIP专属房间' : '指定服务房间',
      value: `${isVip ? 'VIP · ' : ''}${order.room_name} (OOPZ: ${OOPZ_CHANNEL})`,
      password: pwd || '无密码',
      hint: `请进入 OOPZ 频道 ${OOPZ_CHANNEL} 相应房间服务`
    };
  }
  return {
    type: 'pending',
    label: '服务房间',
    value: '待接单成团后由系统自动分配',
    password: '',
    hint: `成团后自动分配 OOPZ ${OOPZ_CHANNEL} 专属包厢`
  };
}

function parseOrderReqAndRemarks(o) {
  if (!o) return { req: '按客服确认要求服务', remark: '' };
  const guarantee = String(o.guarantee_text || '').trim();
  const rawDesc = String(o.description || '').trim();
  const patterns = [
    /^所选款式[：:]/,
    /^保底\s*\d+W/,
    /^(两名打手|一名打手|单人|双人护航)/,
    /^下单时请备注/,
    /^保底计算及通用结算规则详见/,
    /^通用规则与结算标准详见/,
    /^(单陪|双陪)[：:]/,
    /^撤离保障仅双陪生效/,
    /^1陪2加价/,
    /^计时从进对局开始/,
    /^技术档及以上未达要求/,
    /^现有时长选项保留/,
    /^(单陪|双陪)(?:\d+陪\d+)?\s*·/,
    /^本款地图范围[：:]/,
    /^轮盘随机地图/,
    /^机密版地图范围/,
    /^绝密版地图范围/,
    /^结单条件[：:]/,
    /^\d{2}(每局抽取|每局重摇|公开抽取)/,
    /^每局重新挑战/,
    /^英语单[：:]/,
    /^技能单[：:]/,
    /^猫娘单[：:]/,
    /^英语单\/技能单\/猫娘单/,
    /^绝密难度，老板选图/,
    /^老板按带出的红色物品/,
    /^\d+格\+\d+W/,
    /^非洲之心\/海洋之泪/,
    /^基础保底\d+W/,
    /^储值打赏/,
    /^购买数量[：:]/
  ];
  const lines = rawDesc ? rawDesc.split('\n').map((l) => l.trim()).filter(Boolean) : [];
  const tplLines = [];
  const remarkLines = [];
  for (const l of lines) {
    if (patterns.some((p) => p.test(l))) {
      tplLines.push(l);
    } else {
      remarkLines.push(l);
    }
  }
  let req = guarantee;
  if (!req && tplLines.length) {
    const core = tplLines.filter(
      (l) => !l.startsWith('下单时请备注') && !l.startsWith('保底计算') && !l.startsWith('通用规则')
    );
    if (core.length) req = core[0];
  }
  if (!req) {
    if (remarkLines.length) {
      const first = remarkLines[0];
      if (/保底|结单|出泪|要求|打手|难度/.test(first)) {
        req = first;
        remarkLines.shift();
      } else {
        req = '按客服确认要求服务';
      }
    } else {
      req = '按客服确认要求服务';
    }
  }
  const remark = remarkLines.join(' · ').trim();
  return { req, remark };
}

// 服务器公用排序算法 (lib/domain.mjs & public/pool-order.js)
const poolStage = (o) => (['open', 'matching'].includes(o.status) ? 0 : o.status === 'review' ? 2 : 1);
const poolPlaced = (o) => {
  const value = Date.parse(o.created_at || o.published_at);
  return Number.isFinite(value) ? value : 0;
};
function comparePoolOrders(a, b) {
  return (
    poolStage(a) - poolStage(b) ||
    poolPlaced(a) - poolPlaced(b) ||
    String(a.number || a.id).localeCompare(String(b.number || b.id)) ||
    String(a.id).localeCompare(String(b.id))
  );
}
function sortPoolOrders(rows) {
  return [...rows].sort(comparePoolOrders);
}

function getOrderJoinEligibility(order) {
  const active = ['open', 'matching'].includes(order.status);
  const me = (order.participants || []).some((p) => p.user_id === state.user?.id);
  const isOwner = order.customer_id === state.user?.id;
  const isFull = (order.slots || 0) >= (order.worker_count || 1);
  
  let blockedReason = order.blocked_reason || '';
  const noticeUnaccepted = state.notice && state.notice.accepted === false;
  if (!blockedReason && !active) {
    blockedReason = (order.status === 'matched' || order.status === 'service') ? '订单进行中 (打手已就位)' : '订单非待接单状态';
  }
  if (!blockedReason && isFull) {
    blockedReason = '名额已满，不可接单';
  }
  if (!blockedReason && noticeUnaccepted) {
    blockedReason = '未确认最新打手须知';
  }
  
  const canJoin = !order.readonly && active && !me && !isOwner && !order.joined && !noticeUnaccepted && (!blockedReason || blockedReason.includes('黑名单'));
  
  return {
    active,
    joined: me || order.joined,
    isOwner,
    isFull,
    canJoin,
    blockedReason
  };
}

/* ========================================================
   6. 页面一：接单大厅 (Pool View)
   ======================================================== */
function renderPoolView() {
  const container = document.getElementById('main-view-container');
  if (!container) return;

  if (!state.user) {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-title-group">
          <h1>⚡ 接单大厅 (实时抢单)</h1>
          <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">
            请登录灵龙打手账号以连接抢单大厅
          </p>
        </div>
      </div>
      <div class="empty-state">
        <div class="empty-icon">🔐</div>
        <div style="font-size:16px; font-weight:700; color:#fff;">请先登录打手账号</div>
        <div style="font-size:13px; color:var(--text-muted); margin-top:4px;">
          登录后即可同步后端实时工单、抢单履约与管理收益。
        </div>
        <button type="button" class="btn primary" id="btn-empty-login" style="margin-top:14px;">
          <span>🔑</span> 登录打手账号
        </button>
      </div>
    `;
    document.getElementById('btn-empty-login')?.addEventListener('click', showLoginModal);
    return;
  }

  // 筛选器状态过滤
  const filteredOrders = state.poolOrders.filter((order) => {
    // 游戏分类筛选
    if (state.poolDivisionFilter && state.poolDivisionFilter !== 'all') {
      if (order.game_division !== state.poolDivisionFilter) return false;
    }
    // 订单类型筛选
    if (state.poolTypeFilter && state.poolTypeFilter !== 'all') {
      if (state.poolTypeFilter === 'runner') {
        if (order.service_rule !== 'runner' && (!order.title || !order.title.includes('跑刀'))) return false;
      } else if (order.type !== state.poolTypeFilter) {
        return false;
      }
    }
    // 状态筛选
    if (state.poolStatusFilter && state.poolStatusFilter !== 'all') {
      const active = ['open', 'matching'].includes(order.status);
      if (state.poolStatusFilter === 'open' && !active) return false;
      if (state.poolStatusFilter === 'active' && active) return false;
    }
    return true;
  });

  // 对齐服务器公用排序
  const sortedOrders = sortPoolOrders(filteredOrders);

  // 统计各类数量
  const countAll = state.poolOrders.length;
  const countOpen = state.poolOrders.filter((o) => ['open', 'matching'].includes(o.status)).length;
  const countMatched = state.poolOrders.filter((o) => !['open', 'matching'].includes(o.status)).length;

  container.innerHTML = `
    <!-- 顶部状态栏与筛选器 -->
    <div class="page-header">
      <div class="page-title-group">
        <h1>⚡ 接单大厅 (实时抢单)</h1>
        <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">
          待接单按老板下单时间排序 · 开放总池：<span style="color:var(--primary); font-weight:700;">${countAll}</span> 单 (可抢: <span style="color:var(--success); font-weight:700;">${countOpen}</span>, 服务中: ${countMatched})
        </p>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <button type="button" class="btn sm" id="btn-pool-refresh" title="强制刷新订单池">
          <span>🔄</span> 立即刷新
        </button>
      </div>
    </div>

    ${
      state.notice && state.notice.accepted === false
        ? `
      <div class="notice-warning-banner">
        <div class="banner-text">
          <span style="font-size:20px;">⚠️</span>
          <div>
            <div style="font-weight:700; color:var(--warning);">您尚未确认最新版《打手平台使用手册与服务须知》（版本: ${escapeHtml(state.notice.version || 'V4.0')}）</div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">为保障您的接单权益与服务合规，请在接单前完整阅读并在线签署须知。未确认前暂无法抢单。</div>
          </div>
        </div>
        <button type="button" class="btn primary sm" id="btn-banner-go-notice" style="white-space:nowrap;">
          📖 立即查阅并签署
        </button>
      </div>
    `
        : ''
    }

    <!-- 游戏分类筛选 (FlClash Segmented Chips) -->
    <div class="filter-bar" style="margin-bottom:8px;">
      <div class="filter-chip ${(state.poolDivisionFilter || 'all') === 'all' ? 'active' : ''}" data-division="all">全部分类 (${countAll})</div>
      <div class="filter-chip ${state.poolDivisionFilter === 'pc-delta' ? 'active' : ''}" data-division="pc-delta">PC三角洲</div>
      <div class="filter-chip ${state.poolDivisionFilter === 'mobile-delta' ? 'active' : ''}" data-division="mobile-delta">手游三角洲</div>
      <div class="filter-chip ${state.poolDivisionFilter === 'honor' ? 'active' : ''}" data-division="honor">王者荣耀</div>
      <div class="filter-chip ${state.poolDivisionFilter === 'apex' ? 'active' : ''}" data-division="apex">APEX</div>
    </div>

    <!-- 订单类型与状态筛选 -->
    <div class="filter-bar" style="margin-bottom:16px;">
      <div class="filter-chip ${(state.poolTypeFilter || 'all') === 'all' ? 'active' : ''}" data-type="all">全部类型</div>
      <div class="filter-chip ${state.poolTypeFilter === 'escort' ? 'active' : ''}" data-type="escort">护航单</div>
      <div class="filter-chip ${state.poolTypeFilter === 'companion' ? 'active' : ''}" data-type="companion">陪玩单</div>
      <div class="filter-chip ${state.poolTypeFilter === 'runner' ? 'active' : ''}" data-type="runner">跑刀单</div>
      <div class="filter-chip ${state.poolTypeFilter === 'experience' ? 'active' : ''}" data-type="experience">体验单</div>
      <div class="filter-chip ${state.poolTypeFilter === 'fun' ? 'active' : ''}" data-type="fun">趣味单</div>
      <span style="color:var(--line-subtle); margin:0 4px;">|</span>
      <div class="filter-chip ${(state.poolStatusFilter || 'all') === 'all' ? 'active' : ''}" data-status="all">全部状态</div>
      <div class="filter-chip ${state.poolStatusFilter === 'open' ? 'active' : ''}" data-status="open">待接单 (${countOpen})</div>
      <div class="filter-chip ${state.poolStatusFilter === 'active' ? 'active' : ''}" data-status="active">服务中 (${countMatched})</div>
    </div>

    <!-- 订单列表网格 -->
    ${
      sortedOrders.length === 0
        ? `
        <div class="empty-state">
          <div class="empty-icon">🛡️</div>
          <div style="font-size:16px; font-weight:700; color:#fff;">暂无符合条件的订单</div>
          <div style="font-size:13px; color:var(--text-muted);">
            正在保持极速毫秒级长连接监听… 新订单到达时将通过语音与桌面弹窗自动提醒。
          </div>
        </div>
      `
        : `
        <div class="pool-grid">
          ${sortedOrders.map((order) => renderOrderCard(order)).join('')}
        </div>
      `
    }
  `;

  // 绑定事件
  document.getElementById('btn-banner-go-notice')?.addEventListener('click', () => navigateTo('notice'));

  document.getElementById('btn-pool-refresh')?.addEventListener('click', async () => {
    await refreshData();
    showToast('已同步最新订单池', 'success');
  });

  // 分类筛选事件
  container.querySelectorAll('.filter-chip[data-division]').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.poolDivisionFilter = chip.getAttribute('data-division');
      renderPoolView();
    });
  });

  // 类型筛选事件
  container.querySelectorAll('.filter-chip[data-type]').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.poolTypeFilter = chip.getAttribute('data-type');
      renderPoolView();
    });
  });

  // 状态筛选事件
  container.querySelectorAll('.filter-chip[data-status]').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.poolStatusFilter = chip.getAttribute('data-status');
      renderPoolView();
    });
  });

  // 复制房间密码与好友码
  container.querySelectorAll('.copy-pill[data-copy]').forEach((pill) => {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = pill.getAttribute('data-copy');
      navigator.clipboard.writeText(val);
      showToast(`已复制到剪贴板: ${val}`, 'success');
    });
  });

  // 抢单按钮
  container.querySelectorAll('.btn-claim-slot').forEach((btn) => {
    btn.addEventListener('click', () => {
      const orderId = btn.getAttribute('data-id');
      const slot = parseInt(btn.getAttribute('data-slot') || '1', 10);
      handleClaimOrder(orderId, slot);
    });
  });

  // 双人抢单按钮
  container.querySelectorAll('.btn-pair-order').forEach((btn) => {
    btn.addEventListener('click', () => {
      const orderId = btn.getAttribute('data-id');
      handlePairOrderModal(orderId);
    });
  });

  // 订单详情弹窗
  container.querySelectorAll('.btn-order-detail').forEach((btn) => {
    btn.addEventListener('click', () => {
      const orderId = btn.getAttribute('data-id');
      const order = state.poolOrders.find((o) => o.id === orderId);
      if (order) showOrderDetailModal(order);
    });
  });

  // 前往履约按钮
  container.querySelectorAll('.btn-goto-active').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigateTo('active');
    });
  });
}

// 渲染单个接单卡片 (完整对齐服务器 public/features.js 规范)
function renderOrderCard(order) {
  const at = Date.now();
  const publishedTime = Date.parse(order.published_at || order.created_at);
  const elapsedMs = Math.max(0, at - (Number.isFinite(publishedTime) ? publishedTime : at));
  const elapsedMinutes = Math.floor(elapsedMs / 60000);

  const eligibility = getOrderJoinEligibility(order);
  const { active, joined, canJoin, blockedReason } = eligibility;
  const isUrgent = active && elapsedMinutes >= 10;
  const isOverdue = order.service_overdue;
  const isVip = order.room_kind === 'vip';

  const divisionLabel = getDivisionName(order.game_division);
  const typeLabel = getTypeName(order);
  const roomInfo = getRoomInfo(order);
  const { req, remark } = parseOrderReqAndRemarks(order);

  const mapPolicyLabel = { worker: '打手选图', boss: '老板选图', specific: '指定地图' }[order.map_mode] || '老板选图';

  // 槽位渲染
  const workerCount = order.worker_count || 1;
  const slotItems = Array.from({ length: workerCount }, (_, i) => {
    const slotNum = i + 1;
    const participant = (order.participants || []).find((p) => p.slot === slotNum);
    const incomeCents = (order.slot_incomes && order.slot_incomes[i] != null)
      ? order.slot_incomes[i]
      : (order.expected_income || 0);
    const incomeYuan = formatYuan(incomeCents);

    if (participant) {
      return `
        <div class="slot-item filled">
          <div class="slot-header">
            <span>${slotNum}号位 · 已就位</span>
            <span style="color:var(--success);">进行中</span>
          </div>
          <div class="slot-person">
            <div class="slot-avatar-mini">${escapeHtml((participant.nickname || '打')[0])}</div>
            <strong style="font-size:12px; color:#fff;">${escapeHtml(participant.nickname)}</strong>
            <span class="rank-badge">${getRankLabel(participant.worker_level, order.game_division)}</span>
          </div>
          <div class="slot-earning" style="font-size:13px; color:var(--text-muted); margin-top:2px;">
            分成 ¥${incomeYuan}
          </div>
        </div>
      `;
    } else {
      return `
        <div class="slot-item">
          <div class="slot-header">
            <span>${slotNum}号位 · 待接单</span>
            <span style="color:var(--primary);">可接</span>
          </div>
          <div style="font-size:12px; color:var(--text-dim); margin-top:4px;">
            待打手加入席位
          </div>
          <div class="slot-earning" style="margin-top:2px;">
            ¥${incomeYuan}
          </div>
        </div>
      `;
    }
  }).join('');

  // 抢单动作按钮群
  const renderCardActions = () => {
    if (joined) {
      return `
        <span class="pill-badge success">已在单内</span>
        <button type="button" class="btn ghost sm btn-goto-active" data-id="${order.id}">
          🎮 前往履约
        </button>
      `;
    }
    if (canJoin) {
      const slot1Taken = (order.participants || []).some((p) => p.slot === 1);
      const slot2Taken = (order.participants || []).some((p) => p.slot === 2);
      if (workerCount === 2 && !slot1Taken && !slot2Taken) {
        return `
          <button type="button" class="btn primary sm btn-claim-slot" data-id="${order.id}" data-slot="1">
            接1号位 (¥${formatYuan(order.slot_incomes?.[0])})
          </button>
          <button type="button" class="btn primary sm btn-claim-slot" data-id="${order.id}" data-slot="2">
            接2号位 (¥${formatYuan(order.slot_incomes?.[1])})
          </button>
          <button type="button" class="btn ghost sm btn-pair-order" data-id="${order.id}">
            双人抢
          </button>
        `;
      }
      const availableSlot = slot1Taken ? 2 : 1;
      const slotIncome = formatYuan(order.slot_incomes?.[availableSlot - 1] ?? order.expected_income);
      return `
        <button type="button" class="btn primary sm btn-claim-slot" data-id="${order.id}" data-slot="${availableSlot}">
          ⚡ 立即抢单 (¥${slotIncome})
        </button>
      `;
    }
    return `
      <button type="button" class="btn sm disabled" disabled>
        无法接单
      </button>
    `;
  };

  return `
    <div class="order-card ${isUrgent ? 'urgent' : ''}" data-order-id="${order.id}">
      <div class="order-card-header">
        <div class="order-tag-row">
          <span class="pill-badge game">${divisionLabel}</span>
          <span class="pill-badge ${order.type === 'experience' ? 'vip' : ''}">${typeLabel}</span>
          <span class="pill-badge difficulty-top">${order.difficulty || '普通'}</span>
          ${isVip ? '<span class="pill-badge vip">VIP房</span>' : ''}
          <span class="pill-badge" style="background:${active ? 'rgba(72,205,245,0.1)' : 'rgba(255,255,255,0.05)'}; color:${active ? 'var(--primary)' : 'var(--text-muted)'};">
            ${order.slots || 0}/${workerCount} ${active ? (order.status === 'matching' ? '组队中' : '待接单') : '进行中'}
          </span>
        </div>
        <div class="order-time-elapsed">
          已经过 ${elapsedMinutes} 分钟
        </div>
      </div>

      <!-- 指名专属订单横幅 -->
      ${
        order.nominated
          ? `
        <div class="nomination-banner">
          <strong>${order.partial_nomination ? '指名1人，另一名额自由接单' : '指名专属订单'}</strong>
          <span>${(order.named_workers || []).map((w) => `${escapeHtml(w.nickname)} (${getRankLabel(w.worker_level, order.game_division)})`).join(' · ') || '请核对指名信息'}</span>
        </div>
      `
          : ''
      }

      <!-- 超时与加急横幅 -->
      ${
        isOverdue
          ? `
        <div class="priority-banner" style="background:rgba(239,68,68,0.15); border-color:rgba(239,68,68,0.3); color:var(--danger);">
          <span>⚠️ 雇主下单已超过24小时</span>
        </div>
      `
          : ''
      }
      ${
        isUrgent && !isOverdue
          ? `
        <div class="priority-banner">
          <span>🔥 雇主加急单：等待接单超过10分钟，全服优先曝光</span>
          <span>⚡ 加急</span>
        </div>
      `
          : ''
      }

      <div class="order-title">${escapeHtml(order.title)}</div>

      <!-- 雇主与房间凭证信息 (真实数据) -->
      <div class="order-meta-box">
        <div class="meta-row">
          <span class="meta-label">下单老板</span>
          <span class="meta-val">${escapeHtml(order.customer_name || '老板')}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">${roomInfo.label}</span>
          <span class="meta-val" style="color:var(--primary); font-weight:700;">${escapeHtml(roomInfo.value)}</span>
        </div>
        ${
          roomInfo.password
            ? `
          <div class="meta-row">
            <span class="meta-label">房间密码</span>
            <span class="copy-pill" data-copy="${escapeHtml(roomInfo.password)}">
              ${escapeHtml(roomInfo.password)} (点击复制)
            </span>
          </div>
        `
            : ''
        }
        <div class="meta-row">
          <span class="meta-label">对局选图</span>
          <span class="meta-val" style="color:var(--text-main);">
            ${mapPolicyLabel} · ${escapeHtml(order.map_name || '常规地图')} · ${order.scheduled ? `预约 ${escapeHtml(order.scheduled)}` : '即刻开打'}
          </span>
        </div>
      </div>

      <!-- 槽位预估收益网格 -->
      <div class="order-slots-row">
        ${slotItems}
      </div>

      <!-- 规则与保底要求 (真实解析) -->
      <div class="order-requirements">
        <strong>🎯 服务要求：</strong>${escapeHtml(req)}<br/>
        ${remark ? `<strong>📝 订单备注：</strong>${escapeHtml(remark)}<br/>` : ''}
        <span style="font-size:11px; color:var(--text-dim); margin-top:2px; display:inline-block;">
          ${escapeHtml(order.duration || '按订单要求')} · 下单时间：${formatDate(order.created_at || order.published_at)}
        </span>
      </div>

      <!-- 底部操作与原因提示 -->
      <div class="order-card-footer">
        <div style="display:flex; align-items:center; gap:8px;">
          <button type="button" class="btn ghost sm btn-order-detail" data-id="${order.id}">
            详情
          </button>
          ${!canJoin && blockedReason ? `<span class="pill-badge warning">${escapeHtml(blockedReason)}</span>` : ''}
        </div>
        <div style="display:flex; gap:8px;">
          ${renderCardActions()}
        </div>
      </div>
    </div>
  `;
}

// 抢单处理
async function handleClaimOrder(orderId, slot = 1) {
  if (!state.user) {
    showLoginModal();
    return;
  }

  try {
    const res = await api.joinOrder(orderId, slot);
    soundEngine.playSuccessChime();
    showToast(res.message || '抢单成功！已为您锁定该席位，请立即履约。', 'success');
    window.electronAPI?.notify('【灵龙电竞】抢单成功！', '已成功锁定席位，请立即进入游戏或房间联系老板。');
    await refreshData();
    navigateTo('active');
  } catch (err) {
    showToast(err.message || '抢单失败，可能已被其他打手抢先接取或限制接单', 'error');
  }
}

// 双人抢单弹窗
function handlePairOrderModal(orderId) {
  if (!state.user) {
    showLoginModal();
    return;
  }

  showConfirmModal({
    title: '双人抢单 (携带固定队友)',
    body: `
      <div class="form-group">
        <label class="form-label">队友打手工号 / 手机号 / QQ</label>
        <input type="text" class="form-input" id="pair-partner-input" placeholder="输入队友的打手账号或工号" autofocus />
        <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">
          队友也必须为灵龙认证打手且处于空闲状态，抢单成功后两人将同时绑定入该订单。
        </p>
      </div>
    `,
    confirmText: '确认双人抢单',
    onConfirm: async () => {
      const partnerId = document.getElementById('pair-partner-input')?.value.trim();
      if (!partnerId) {
        showToast('请输入队友打手编号或手机号', 'error');
        return;
      }
      try {
        const res = await api.pairOrder(orderId, partnerId);
        soundEngine.playSuccessChime();
        showToast(res.message || '双人抢单成功！', 'success');
        closeModal();
        await refreshData();
        navigateTo('active');
      } catch (e) {
        showToast(e.message || '双人抢单失败', 'error');
      }
    }
  });
}

// 订单详情弹窗 (准确对齐业务细则)
function showOrderDetailModal(order) {
  const eligibility = getOrderJoinEligibility(order);
  const { canJoin, blockedReason } = eligibility;
  const roomInfo = getRoomInfo(order);
  const { req, remark } = parseOrderReqAndRemarks(order);

  const participantsList = (order.participants || []).length > 0
    ? order.participants.map((p) => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:4px 0;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="slot-avatar-mini">${escapeHtml((p.nickname || '打')[0])}</span>
            <strong>${escapeHtml(p.nickname)}</strong>
            <span class="rank-badge">${getRankLabel(p.worker_level, order.game_division)}</span>
          </div>
          <span style="font-size:12px; color:var(--text-muted);">${p.slot}号位</span>
        </div>
      `).join('')
    : '<div style="color:var(--text-dim); font-size:12px;">暂无打手加入，席位空闲中</div>';

  showConfirmModal({
    title: `订单详情 · ${order.title}`,
    body: `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div class="order-meta-box">
          <div class="meta-row">
            <span class="meta-label">订单编号</span>
            <span class="meta-val" style="font-family:monospace; color:var(--primary);">${escapeHtml(order.number || order.id)}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">所属分类</span>
            <span class="meta-val">${getDivisionName(order.game_division)} · ${getTypeName(order)} · ${order.difficulty || '普通'}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">下单老板</span>
            <span class="meta-val">${escapeHtml(order.customer_name || '老板')}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">${roomInfo.label}</span>
            <span class="meta-val" style="color:var(--primary);">${escapeHtml(roomInfo.value)}</span>
          </div>
          ${
            roomInfo.password
              ? `
            <div class="meta-row">
              <span class="meta-label">进房密码</span>
              <span class="meta-val">${escapeHtml(roomInfo.password)}</span>
            </div>
          `
              : ''
          }
          <div class="meta-row">
            <span class="meta-label">单席位预计收益</span>
            <span class="meta-val" style="color:var(--primary); font-weight:700;">¥${formatYuan(order.slot_incomes?.[0] ?? order.expected_income)}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">订单状态</span>
            <span class="meta-val">${getStatusName(order.status)}</span>
          </div>
        </div>

        <div class="table-panel" style="padding:12px; margin:0;">
          <div class="table-header-title" style="font-size:12px; margin-bottom:6px;">当前席位打手</div>
          ${participantsList}
        </div>

        <div class="order-requirements" style="font-size:13px;">
          <strong>🎯 服务要求：</strong>${escapeHtml(req)}<br/>
          ${remark ? `<strong>📝 订单备注：</strong>${escapeHtml(remark)}<br/>` : ''}
          ${order.description ? `<p style="font-size:11px; color:var(--text-dim); margin-top:4px;">${escapeHtml(order.description)}</p>` : ''}
        </div>

        ${
          !canJoin && blockedReason
            ? `<div class="pill-badge warning" style="text-align:center; padding:6px 12px; border-radius:var(--radius-sm); font-size:12px;">⚠️ 无法接单提示：${escapeHtml(blockedReason)}</div>`
            : ''
        }
      </div>
    `,
    confirmText: canJoin ? '⚡ 立即接单' : '关闭',
    cancelText: canJoin ? '取消' : '',
    onConfirm: async () => {
      closeModal();
      if (canJoin) {
        await handleClaimOrder(order.id, 1);
      }
    }
  });
}

/* ========================================================
   7. 页面二：履约中订单 (Active Orders View)
   ======================================================== */
function renderActiveOrdersView() {
  const container = document.getElementById('main-view-container');
  if (!container) return;

  if (!state.user) {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-title-group">
          <h1>🎮 当前履约订单</h1>
          <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">
            请登录灵龙打手账号以查看履约中的订单
          </p>
        </div>
      </div>
      <div class="empty-state">
        <div class="empty-icon">🔐</div>
        <div style="font-size:16px; font-weight:700; color:#fff;">请先登录打手账号</div>
        <div style="font-size:13px; color:var(--text-muted); margin-top:4px;">
          登录后即可查看正在执行的工单与结单操作。
        </div>
        <button type="button" class="btn primary" id="btn-empty-login" style="margin-top:14px;">
          <span>🔑</span> 登录打手账号
        </button>
      </div>
    `;
    document.getElementById('btn-empty-login')?.addEventListener('click', showLoginModal);
    return;
  }

  const activeOrders = (state.dashboardData?.workerOrders || []).filter(
    (o) => o.status === 'matched' || o.status === 'in_progress'
  );

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <h1>🎮 当前履约订单</h1>
        <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">
          请在约定时间内前往房间为雇主提供电竞陪玩/护航服务，完成后及时上传结单凭证。
        </p>
      </div>
      <div>
        <button type="button" class="btn sm" id="btn-active-refresh">
          <span>🔄</span> 刷新状态
        </button>
      </div>
    </div>

    ${
      activeOrders.length === 0
        ? `
        <div class="empty-state">
          <div class="empty-icon">🎮</div>
          <div style="font-size:16px; font-weight:700; color:#fff;">暂无进行中的履约单</div>
          <div style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">
            您当前处于空闲可接状态，请前往接单大厅接取心仪订单。
          </div>
          <button type="button" class="btn primary" id="btn-goto-pool">前往接单大厅</button>
        </div>
      `
        : `
        <div style="display:flex; flex-direction:column; gap:16px;">
          ${activeOrders.map((order) => renderActiveOrderCard(order)).join('')}
        </div>
      `
    }
  `;

  document.getElementById('btn-active-refresh')?.addEventListener('click', () => refreshData());
  document.getElementById('btn-goto-pool')?.addEventListener('click', () => navigateTo('pool'));

  // 绑定结单 / 转单 / 放弃事件
  container.querySelectorAll('.btn-complete-order').forEach((btn) => {
    btn.addEventListener('click', () => {
      const orderId = btn.getAttribute('data-id');
      handleCompleteOrderModal(orderId);
    });
  });

  container.querySelectorAll('.btn-transfer-order').forEach((btn) => {
    btn.addEventListener('click', () => {
      const orderId = btn.getAttribute('data-id');
      handleTransferOrderModal(orderId);
    });
  });

  container.querySelectorAll('.btn-leave-order').forEach((btn) => {
    btn.addEventListener('click', () => {
      const orderId = btn.getAttribute('data-id');
      handleLeaveOrderModal(orderId);
    });
  });

  // 复制
  container.querySelectorAll('.copy-pill[data-copy]').forEach((pill) => {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = pill.getAttribute('data-copy');
      navigator.clipboard.writeText(val);
      showToast(`已复制: ${val}`, 'success');
    });
  });
}

function renderActiveOrderCard(order) {
  return `
    <div class="order-card" style="border-left: 4px solid var(--primary);">
      <div class="order-card-header">
        <div class="order-tag-row">
          <span class="pill-badge" style="background:var(--primary-bg); color:var(--primary); font-weight:700;">
            进行中 · 履约中
          </span>
          <span class="pill-badge">${order.number || order.id}</span>
          <span class="pill-badge difficulty-top">${order.difficulty || '绝密'}</span>
          <span class="pill-badge">${order.map_name || '航天基地'}</span>
        </div>
        <div style="font-size:13px; color:var(--gold); font-weight:700;">
          预估应结收益: ¥${order.my_share_income || order.list_amount || 0}
        </div>
      </div>

      <div class="order-title" style="font-size:18px;">${escapeHtml(order.title)}</div>

      <!-- 关键对局联络信息 -->
      <div class="order-meta-box">
        <div class="meta-row">
          <span class="meta-label">老板称谓 / QQ</span>
          <span class="copy-pill" data-copy="${escapeHtml(order.customer_qq || order.customer_name)}">
            ${escapeHtml(order.customer_name || '老板')} (点击复制联络)
          </span>
        </div>
        <div class="meta-row">
          <span class="meta-label">指定YY / 房间号</span>
          <span class="meta-val">${escapeHtml(order.room_name || '专属包厢')}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">进房密码</span>
          <span class="copy-pill" data-copy="${escapeHtml(order.room_password || '无')}">
            ${escapeHtml(order.room_password || '无密码')} (点击复制进房)
          </span>
        </div>
      </div>

      <div class="order-requirements">
        <strong>履约要求：</strong>${escapeHtml(order.guarantee_text || '保底未完成前请全力配合。')}
      </div>

      <!-- 操作按钮群 -->
      <div class="order-card-footer">
        <button type="button" class="btn danger sm btn-leave-order" data-id="${order.id}">
          ⚠️ 放弃/退出
        </button>
        <div style="display:flex; gap:10px;">
          <button type="button" class="btn ghost sm btn-transfer-order" data-id="${order.id}">
            🔄 发起转单
          </button>
          <button type="button" class="btn primary sm btn-complete-order" data-id="${order.id}">
            🏆 结单提交审核
          </button>
        </div>
      </div>
    </div>
  `;
}

// 结单弹窗
function handleCompleteOrderModal(orderId) {
  showConfirmModal({
    title: '提交订单完成并结单',
    body: `
      <div class="form-group">
        <label class="form-label">服务完成说明 (如已撤离金额、服务局数等)</label>
        <textarea class="form-textarea" id="complete-notes-input" rows="3" placeholder="例如：长弓溪谷绝密保底888W已全数完成，老板顺利撤离。"></textarea>
      </div>
      <p style="font-size:12px; color:var(--text-muted); margin-top:8px;">
        提交后系统将进入审核核实结算，资金将入账至您的打手钱包。
      </p>
    `,
    confirmText: '确认结单',
    onConfirm: async () => {
      const notes = document.getElementById('complete-notes-input')?.value.trim();
      try {
        const res = await api.completeOrder(orderId, { notes });
        soundEngine.playSuccessChime();
        showToast(res.message || '结单申请已提交！', 'success');
        closeModal();
        await refreshData();
        navigateTo('active');
      } catch (e) {
        showToast(e.message || '提交结单失败', 'error');
      }
    }
  });
}

// 转单弹窗
function handleTransferOrderModal(orderId) {
  showConfirmModal({
    title: '发起订单转单',
    body: `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div class="form-group">
          <label class="form-label">接收打手编号 / 手机号</label>
          <input type="text" class="form-input" id="transfer-target-input" placeholder="输入接盘打手的工号或手机号" />
        </div>
        <div class="form-group">
          <label class="form-label">您已完成的进度百分比 (%)</label>
          <input type="number" class="form-input" id="transfer-bps-input" min="0" max="100" value="0" placeholder="例如已完成一半填 50" />
          <span style="font-size:11px; color:var(--text-dim);">根据已完成进度按比例折算原订单佣金分成。</span>
        </div>
        <div class="form-group">
          <label class="form-label">转单留言与原因</label>
          <input type="text" class="form-input" id="transfer-note-input" placeholder="例如：突发断网，转交给兄弟继续打" />
        </div>
      </div>
    `,
    confirmText: '发起转单',
    onConfirm: async () => {
      const toId = document.getElementById('transfer-target-input')?.value.trim();
      const pct = parseFloat(document.getElementById('transfer-bps-input')?.value || '0');
      const note = document.getElementById('transfer-note-input')?.value.trim();

      if (!toId) {
        showToast('请输入接收打手编号', 'error');
        return;
      }

      try {
        const res = await api.transferOrder(orderId, {
          to_id: toId,
          completion_bps: Math.round(pct * 100),
          note
        });
        showToast(res.message || '转单请求已发出，等待对方打手确认接收', 'success');
        closeModal();
        await refreshData();
      } catch (e) {
        showToast(e.message || '转单失败', 'error');
      }
    }
  });
}

// 放弃订单弹窗
function handleLeaveOrderModal(orderId) {
  showConfirmModal({
    title: '确认退出该订单？',
    body: `
      <div class="form-group">
        <label class="form-label">放弃/退出原因</label>
        <input type="text" class="form-input" id="leave-reason-input" placeholder="请简述退出原因" value="打手个人原因放弃" />
      </div>
      <p style="font-size:12px; color:var(--danger); margin-top:8px;">
        ⚠️ 注意：中途无故放弃订单可能会扣除打手信誉积分并影响派单权重，请妥善处理。
      </p>
    `,
    confirmText: '确认放弃',
    onConfirm: async () => {
      const reason = document.getElementById('leave-reason-input')?.value.trim();
      try {
        const res = await api.leaveOrder(orderId, reason);
        showToast(res.message || '已退出订单，位置已释放', 'info');
        closeModal();
        await refreshData();
        navigateTo('active');
      } catch (e) {
        showToast(e.message || '退出失败', 'error');
      }
    }
  });
}

/* ========================================================
   8. 页面三：全部订单 (All Orders View)
   ======================================================== */
function renderAllOrdersView() {
  const container = document.getElementById('main-view-container');
  if (!container) return;

  if (!state.user) {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-title-group">
          <h1>📋 全部订单</h1>
          <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">
            请登录灵龙打手账号以查看全部工单明细
          </p>
        </div>
      </div>
      <div class="empty-state">
        <div class="empty-icon">🔐</div>
        <div style="font-size:16px; font-weight:700; color:#fff;">请先登录打手账号</div>
        <div style="font-size:13px; color:var(--text-muted); margin-top:4px;">
          登录后即可检索历史与履约中的全部工单清单。
        </div>
        <button type="button" class="btn primary" id="btn-empty-login" style="margin-top:14px;">
          <span>🔑</span> 登录打手账号
        </button>
      </div>
    `;
    document.getElementById('btn-empty-login')?.addEventListener('click', showLoginModal);
    return;
  }

  // 默认范围：'all_platform' (全平台工单) 或 'my_orders' (我的接单)
  state.allOrdersScope = state.allOrdersScope || 'all_platform';
  state.allOrdersFilter = state.allOrdersFilter || 'all';
  state.allOrdersDivision = state.allOrdersDivision || 'all';
  state.allOrdersSearch = state.allOrdersSearch || '';

  const myOrders = state.dashboardData?.workerOrders || [];
  const poolOrders = state.poolOrders || [];

  // 合并全部唯一订单 (全平台工单)
  const combinedMap = new Map();
  poolOrders.forEach((o) => combinedMap.set(o.id, o));
  myOrders.forEach((o) => {
    if (!combinedMap.has(o.id)) combinedMap.set(o.id, o);
  });
  const allPlatformOrders = Array.from(combinedMap.values());

  const activeDataset = state.allOrdersScope === 'my_orders' ? myOrders : allPlatformOrders;

  // 过滤
  const filteredOrders = activeDataset.filter((o) => {
    // 搜索关键词
    if (state.allOrdersSearch) {
      const q = state.allOrdersSearch.toLowerCase();
      const matchNum = String(o.number || o.id).toLowerCase().includes(q);
      const matchTitle = String(o.title || '').toLowerCase().includes(q);
      const matchCustomer = String(o.customer_name || '').toLowerCase().includes(q);
      if (!matchNum && !matchTitle && !matchCustomer) return false;
    }
    // 游戏分类
    if (state.allOrdersDivision !== 'all') {
      if (o.game_division !== state.allOrdersDivision) return false;
    }
    // 状态过滤
    if (state.allOrdersFilter !== 'all') {
      if (state.allOrdersFilter === 'open') {
        if (!['open', 'matching'].includes(o.status)) return false;
      } else if (state.allOrdersFilter === 'active') {
        if (!['matched', 'service'].includes(o.status)) return false;
      } else if (state.allOrdersFilter === 'review') {
        if (o.status !== 'review') return false;
      } else if (state.allOrdersFilter === 'completed') {
        if (o.status !== 'completed' && o.status !== 'paid') return false;
      } else if (state.allOrdersFilter === 'transferred') {
        if (!o.transferred) return false;
      }
    }
    return true;
  });

  // 排序
  const sortedOrders = sortPoolOrders(filteredOrders);

  const countPlatform = allPlatformOrders.length;
  const countMine = myOrders.length;

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <h1>📋 全部订单</h1>
        <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">
          检索全平台工单池与您的个人履约记录 · 实时对接官方服务器
        </p>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <button type="button" class="btn sm" id="btn-orders-refresh">
          <span>🔄</span> 刷新工单
        </button>
      </div>
    </div>

    <!-- 范围切换标签 (全平台工单 / 我的接单记录) -->
    <div class="filter-bar" style="margin-bottom:10px; background:rgba(0,0,0,0.25); padding:6px; border-radius:var(--radius-lg);">
      <div class="filter-chip ${state.allOrdersScope === 'all_platform' ? 'active' : ''}" data-scope="all_platform">
        🌐 全平台工单池 (${countPlatform})
      </div>
      <div class="filter-chip ${state.allOrdersScope === 'my_orders' ? 'active' : ''}" data-scope="my_orders">
        👤 我的接单记录 (${countMine})
      </div>
    </div>

    <!-- 分类与状态筛选栏 -->
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
      <div class="filter-bar" style="margin-bottom:0;">
        <div class="filter-chip ${state.allOrdersDivision === 'all' ? 'active' : ''}" data-division="all">全部游戏</div>
        <div class="filter-chip ${state.allOrdersDivision === 'pc-delta' ? 'active' : ''}" data-division="pc-delta">PC三角洲</div>
        <div class="filter-chip ${state.allOrdersDivision === 'mobile-delta' ? 'active' : ''}" data-division="mobile-delta">手游三角洲</div>
        <span style="color:var(--line-subtle); margin:0 4px;">|</span>
        <div class="filter-chip ${state.allOrdersFilter === 'all' ? 'active' : ''}" data-status="all">全部状态</div>
        <div class="filter-chip ${state.allOrdersFilter === 'open' ? 'active' : ''}" data-status="open">待接单</div>
        <div class="filter-chip ${state.allOrdersFilter === 'active' ? 'active' : ''}" data-status="active">进行中</div>
        <div class="filter-chip ${state.allOrdersFilter === 'review' ? 'active' : ''}" data-status="review">待确认</div>
        <div class="filter-chip ${state.allOrdersFilter === 'completed' ? 'active' : ''}" data-status="completed">已结算</div>
      </div>
      
      <!-- 搜索框 -->
      <div style="display:flex; align-items:center; gap:8px;">
        <input type="text" class="form-input" id="input-order-search" placeholder="搜索单号 / 标题 / 老板" value="${escapeHtml(state.allOrdersSearch)}" style="width:200px; padding:6px 12px; font-size:12px;" />
        ${state.allOrdersSearch ? '<button type="button" class="btn ghost sm" id="btn-clear-search">✕</button>' : ''}
      </div>
    </div>

    <div class="table-panel">
      <div class="table-header-bar">
        <div class="table-header-title">
          ${state.allOrdersScope === 'all_platform' ? '全平台工单清单' : '我的接单清单'} 
          <span style="font-size:12px; font-weight:normal; color:var(--text-muted);">(显示 ${sortedOrders.length} 笔)</span>
        </div>
      </div>
      ${
        sortedOrders.length === 0
          ? `
          <div class="empty-state">
            <div class="empty-icon">📂</div>
            <div style="font-size:14px; font-weight:600; color:#fff;">暂无符合条件的工单</div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
              ${state.allOrdersScope === 'my_orders' ? '您当前尚未接取任何订单，可切换至【全平台工单池】进行抢单接单。' : '暂无匹配的订单记录。'}
            </div>
            ${
              state.allOrdersScope === 'my_orders'
                ? `
              <button type="button" class="btn primary sm" id="btn-goto-pool-orders" style="margin-top:12px;">
                查看全平台工单
              </button>
            `
                : ''
            }
          </div>
        `
          : `
          <table class="custom-table">
            <thead>
              <tr>
                <th style="width:170px;">订单编号 / 项目</th>
                <th>业务 / 难度</th>
                <th>服务房间 / 凭证</th>
                <th>席位打手</th>
                <th>打手收益</th>
                <th>状态</th>
                <th>下单时间</th>
                <th style="text-align:right;">操作</th>
              </tr>
            </thead>
            <tbody>
              ${sortedOrders
                .map((o) => {
                  const room = getRoomInfo(o);
                  const income = o.my_income ?? o.slot_incomes?.[0] ?? o.expected_income ?? 0;
                  const incomeYuan = formatYuan(income);
                  const participantsStr = (o.participants || []).map((p) => escapeHtml(p.nickname)).join(' / ') || '席位空闲';

                  return `
                    <tr>
                      <td>
                        <span class="pill-badge game" style="margin-bottom:3px; font-size:10px;">${getDivisionName(o.game_division)}</span>
                        <div style="font-weight:600; font-size:13px; color:#fff;">${escapeHtml(o.title)}</div>
                        <small style="font-family:monospace; color:var(--text-muted);">${escapeHtml(o.number || o.id)}</small>
                      </td>
                      <td>
                        <span class="pill-badge ${o.type === 'experience' ? 'vip' : ''}">${getTypeName(o)}</span>
                        <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">${escapeHtml(o.difficulty || '普通')} · ${escapeHtml(o.duration || '单局')}</div>
                      </td>
                      <td>
                        <div style="font-size:12px; color:var(--primary); font-weight:600;">${escapeHtml(room.value)}</div>
                        ${
                          room.password
                            ? `<small class="copy-pill" data-copy="${escapeHtml(room.password)}" style="margin-top:2px;">密: ${escapeHtml(room.password)}</small>`
                            : `<small style="color:var(--text-dim);">${escapeHtml(room.hint)}</small>`
                        }
                      </td>
                      <td>
                        <div style="font-size:12px; color:var(--text-main);">${participantsStr}</div>
                        <small style="color:var(--text-dim);">${o.slots || 0}/${o.worker_count || 1} 席位</small>
                      </td>
                      <td>
                        <div style="color:var(--success); font-weight:700; font-size:14px; white-space:nowrap;">+¥${incomeYuan}</div>
                        <small style="color:var(--text-dim); white-space:nowrap;">${o.status === 'completed' ? '已结算' : '预计分成'}</small>
                      </td>
                      <td>
                        <span class="pill-badge" style="background:${getStatusBg(o.transferred ? 'transferred' : o.status)}; color:${getStatusColor(o.transferred ? 'transferred' : o.status)};">
                          ${o.transferred ? '已转单' : getStatusName(o.status)}
                        </span>
                      </td>
                      <td style="font-size:11px; color:var(--text-dim); white-space:nowrap;">
                        ${formatDate(o.created_at || o.published_at)}
                      </td>
                      <td style="text-align:right; white-space:nowrap;">
                        <button type="button" class="btn ghost sm btn-table-detail" data-id="${o.id}">
                          详情
                        </button>
                      </td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        `
      }
    </div>
  `;

  // 范围切换事件
  container.querySelectorAll('.filter-chip[data-scope]').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.allOrdersScope = chip.getAttribute('data-scope');
      renderAllOrdersView();
    });
  });

  // 分类筛选事件
  container.querySelectorAll('.filter-chip[data-division]').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.allOrdersDivision = chip.getAttribute('data-division');
      renderAllOrdersView();
    });
  });

  // 状态筛选事件
  container.querySelectorAll('.filter-chip[data-status]').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.allOrdersFilter = chip.getAttribute('data-status');
      renderAllOrdersView();
    });
  });

  // 搜索框事件
  const searchInput = document.getElementById('input-order-search');
  searchInput?.addEventListener('input', (e) => {
    state.allOrdersSearch = e.target.value.trim();
  });
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      renderAllOrdersView();
    }
  });

  // 清除搜索
  document.getElementById('btn-clear-search')?.addEventListener('click', () => {
    state.allOrdersSearch = '';
    renderAllOrdersView();
  });

  // 刷新事件
  document.getElementById('btn-orders-refresh')?.addEventListener('click', async () => {
    await refreshData();
    showToast('已同步最新工单列表', 'success');
  });

  // 跳转全平台工单
  document.getElementById('btn-goto-pool-orders')?.addEventListener('click', () => {
    state.allOrdersScope = 'all_platform';
    renderAllOrdersView();
  });

  // 复制密码
  container.querySelectorAll('.copy-pill[data-copy]').forEach((pill) => {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = pill.getAttribute('data-copy');
      navigator.clipboard.writeText(val);
      showToast(`已复制到剪贴板: ${val}`, 'success');
    });
  });

  // 详情弹窗
  container.querySelectorAll('.btn-table-detail').forEach((btn) => {
    btn.addEventListener('click', () => {
      const orderId = btn.getAttribute('data-id');
      const order = activeDataset.find((o) => o.id === orderId);
      if (order) showOrderDetailModal(order);
    });
  });
}

/* ========================================================
   9. 页面四：收益与提现 (Ledger View)
   ======================================================== */
function renderLedgerView() {
  const container = document.getElementById('main-view-container');
  if (!container) return;

  if (!state.user) {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-title-group">
          <h1>💰 收益流水与提现</h1>
          <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">
            请登录灵龙打手账号以管理钱包流水与提现
          </p>
        </div>
      </div>
      <div class="empty-state">
        <div class="empty-icon">🔐</div>
        <div style="font-size:16px; font-weight:700; color:#fff;">请先登录打手账号</div>
        <div style="font-size:13px; color:var(--text-muted); margin-top:4px;">
          登录后即可查看可用余额、累计收益、流水明细与申请提现。
        </div>
        <button type="button" class="btn primary" id="btn-empty-login" style="margin-top:14px;">
          <span>🔑</span> 登录打手账号
        </button>
      </div>
    `;
    document.getElementById('btn-empty-login')?.addEventListener('click', showLoginModal);
    return;
  }

  const income = state.dashboardData?.income || {
    earned: 0,
    available: 0,
    frozen: 0,
    pending: 0,
    completed: 0
  };

  const ledger = state.dashboardData?.ledger || [];
  const withdrawals = state.dashboardData?.withdrawals || [];

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <h1>💰 收益流水与提现</h1>
        <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">
          打手钱包资金清晰透明，满500元免手续费，支持微信零钱快速到账。
        </p>
      </div>
      <div>
        <button type="button" class="btn primary" id="btn-open-withdraw-modal">
          <span>💳</span> 申请提现
        </button>
      </div>
    </div>

    <!-- 四项资产看板 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">可提现余额</div>
        <div class="stat-val primary-val">¥${income.available.toFixed(2)}</div>
        <div class="stat-desc">支持即时申请微信零钱结算</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">累计总收益</div>
        <div class="stat-val gold-val">¥${income.earned.toFixed(2)}</div>
        <div class="stat-desc">已累计完成 ${income.completed || 0} 单服务</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">履约冻结中</div>
        <div class="stat-val">¥${income.frozen.toFixed(2)}</div>
        <div class="stat-desc">履约中或提现处理中资金</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">待审核结算</div>
        <div class="stat-val">¥${income.pending.toFixed(2)}</div>
        <div class="stat-desc">结单审核通过后自动进入可用</div>
      </div>
    </div>

    <!-- 财务收支明细表 -->
    <div class="table-panel">
      <div class="table-header-bar">
        <div class="table-header-title">打手钱包收支流水</div>
      </div>
      ${
        ledger.length === 0
          ? `
          <div class="empty-state">
            <div class="empty-icon">📊</div>
            <div style="font-size:13px; color:var(--text-muted);">暂无财务变动记录</div>
          </div>
        `
          : `
          <table class="custom-table">
            <thead>
              <tr>
                <th>交易流水号</th>
                <th>账目类型</th>
                <th>业务描述</th>
                <th>变动金额</th>
                <th>变动后结余</th>
                <th>入账时间</th>
              </tr>
            </thead>
            <tbody>
              ${ledger
                .map(
                  (item) => `
                <tr>
                  <td style="font-family:monospace; color:var(--text-dim);">${item.id}</td>
                  <td>
                    <span class="pill-badge">${formatLedgerKind(item.kind || item.type)}</span>
                  </td>
                  <td style="font-weight:600;">${escapeHtml(item.title || item.note || '佣金入账')}</td>
                  <td style="font-weight:700; color:${item.amount >= 0 ? 'var(--success)' : 'var(--danger)'};">
                    ${item.amount >= 0 ? `+¥${item.amount.toFixed(2)}` : `-¥${Math.abs(item.amount).toFixed(2)}`}
                  </td>
                  <td style="font-weight:600; color:var(--text-main);">¥${(item.balance_after || 0).toFixed(2)}</td>
                  <td style="font-size:12px; color:var(--text-dim);">${formatDate(item.created_at)}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        `
      }
    </div>

    <!-- 提现工单记录 -->
    <div class="table-panel">
      <div class="table-header-bar">
        <div class="table-header-title">提现工单处理进度</div>
      </div>
      ${
        withdrawals.length === 0
          ? `
          <div class="empty-state">
            <div class="empty-icon">💳</div>
            <div style="font-size:13px; color:var(--text-muted);">暂无提现工单</div>
          </div>
        `
          : `
          <table class="custom-table">
            <thead>
              <tr>
                <th>工单号</th>
                <th>申请提现金额</th>
                <th>平台手续费</th>
                <th>结算方式</th>
                <th>审核状态</th>
                <th>申请时间</th>
              </tr>
            </thead>
            <tbody>
              ${withdrawals
                .map(
                  (w) => `
                <tr>
                  <td style="font-family:monospace; color:var(--primary);">${w.id}</td>
                  <td style="font-weight:700; color:#fff;">¥${w.amount.toFixed(2)}</td>
                  <td style="color:var(--text-muted);">¥${(w.fee || 0).toFixed(2)}</td>
                  <td>微信零钱</td>
                  <td>
                    <span class="pill-badge" style="background:${w.status === 'completed' ? 'var(--success-bg)' : 'var(--warning-bg)'}; color:${w.status === 'completed' ? 'var(--success)' : 'var(--warning)'};">
                      ${w.status === 'completed' ? '已打款入账' : '财务审核中'}
                    </span>
                  </td>
                  <td style="font-size:12px; color:var(--text-dim);">${formatDate(w.created_at)}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        `
      }
    </div>
  `;

  // 打开提现申请弹窗
  document.getElementById('btn-open-withdraw-modal')?.addEventListener('click', () => {
    handleWithdrawModal(income.available);
  });
}

// 提现弹窗
function handleWithdrawModal(available) {
  showConfirmModal({
    title: '申请佣金提现',
    body: `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div style="background:var(--surface-block); padding:12px; border-radius:var(--radius-md);">
          <div style="font-size:12px; color:var(--text-muted);">当前可提现可用余额</div>
          <div style="font-size:22px; font-weight:800; color:var(--primary); margin-top:2px;">¥${available.toFixed(2)}</div>
        </div>
        <div class="form-group">
          <label class="form-label">提现金额 (元，须为100的整数倍)</label>
          <input type="number" class="form-input" id="withdraw-amount-input" step="100" min="100" max="${Math.floor(available)}" placeholder="例如：500" />
        </div>
        <div style="font-size:12px; color:var(--text-muted); line-height:1.6;">
          • 单笔提现 ≥ ¥500 免平台手续费，< ¥500 扣除 ¥1.00 支付通道费。<br/>
          • 款项将原路打款至您微信实名绑定的零钱账户中，通常于24小时内核实发放。
        </div>
      </div>
    `,
    confirmText: '提交提现申请',
    onConfirm: async () => {
      const amount = parseFloat(document.getElementById('withdraw-amount-input')?.value || '0');
      if (isNaN(amount) || amount < 100 || amount % 100 !== 0) {
        showToast('提现金额须为100的整数倍且不低于100元', 'error');
        return;
      }
      if (amount > available) {
        showToast('提现金额超出可用余额', 'error');
        return;
      }

      try {
        const res = await api.applyWithdrawal(amount);
        soundEngine.playSuccessChime();
        showToast(res.message || '提现申请已提交，财务将在24小时内核验打款！', 'success');
        closeModal();
        await refreshData();
      } catch (e) {
        showToast(e.message || '申请提现失败', 'error');
      }
    }
  });
}

/* ========================================================
   10. 页面五：打手个人中心 (Profile View)
   ======================================================== */
function renderProfileView() {
  const container = document.getElementById('main-view-container');
  if (!container) return;

  if (!state.user) {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-title-group">
          <h1>👤 打手中心与个人档案</h1>
          <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">
            请登录灵龙打手账号以查看打手认证与评级
          </p>
        </div>
      </div>
      <div class="empty-state">
        <div class="empty-icon">🔐</div>
        <div style="font-size:16px; font-weight:700; color:#fff;">请先登录打手账号</div>
        <div style="font-size:13px; color:var(--text-muted); margin-top:4px;">
          登录后即可查看打手认证段位、信誉分、评价与打赏记录。
        </div>
        <button type="button" class="btn primary" id="btn-empty-login" style="margin-top:14px;">
          <span>🔑</span> 登录打手账号
        </button>
      </div>
    `;
    document.getElementById('btn-empty-login')?.addEventListener('click', showLoginModal);
    return;
  }

  const user = state.user || {};
  const rating = state.dashboardData?.rating || {};
  const avgStars = rating.average_stars != null ? Number(rating.average_stars).toFixed(2) : '5.00';
  const reviews = state.dashboardData?.reviews || [];
  const tips = state.dashboardData?.receivedTips || [];

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <h1>👤 打手中心与个人档案</h1>
        <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">
          管理您的段位资质、查看客户好评打赏与灵龙打手公约。
        </p>
      </div>
      <div>
        <button type="button" class="btn ghost sm" id="btn-view-notice">
          📜 查看打手安全须知
        </button>
      </div>
    </div>

    <!-- 个人名片与评分总览 -->
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
      <div class="table-panel" style="padding:20px; display:flex; flex-direction:column; gap:14px;">
        <div style="display:flex; align-items:center; gap:14px;">
          <img src="./assets/mascot.webp" style="width:56px; height:56px; border-radius:var(--radius-full); border:2px solid var(--primary);" alt="打手头像" />
          <div>
            <div style="font-size:18px; font-weight:800; color:#fff;">${escapeHtml(user.nickname || user.username || '打手魔王')}</div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">
              工号: <span style="font-family:monospace; color:var(--primary);">${user.id || 'w-001'}</span> · 手机: ${user.phone || '138****0000'}
            </div>
          </div>
        </div>

        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:4px;">
          <span class="pill-badge" style="background:var(--primary-bg); color:var(--primary); font-weight:700;">
            Lv.${user.worker_level || 5} 灵龙顶级打手
          </span>
          <span class="pill-badge" style="background:var(--success-bg); color:var(--success);">
            平台实名已认证
          </span>
          <span class="pill-badge" style="background:var(--gold-bg); color:var(--gold);">
            全卡资格持有人
          </span>
        </div>

        <div style="border-top:1px solid var(--line-subtle); padding-top:12px; display:flex; flex-direction:column; gap:6px;">
          <div class="meta-row">
            <span class="meta-label">PC端三角洲段位资质</span>
            <span class="meta-val" style="color:var(--primary);">绝密/机密 直通资质</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">手游端三角洲段位资质</span>
            <span class="meta-val" style="color:var(--primary);">绝密组队直通资质</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">联系QQ</span>
            <span class="meta-val">${user.qq || '2537191378'}</span>
          </div>
        </div>
      </div>

      <!-- 好评与信誉卡片 -->
      <div class="table-panel" style="padding:20px; display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <div class="table-header-title" style="margin-bottom:12px;">雇主服务好评综合指数</div>
          <div style="display:flex; align-items:baseline; gap:10px;">
            <div style="font-size:36px; font-weight:900; color:var(--gold); font-variant-numeric:tabular-nums;">
              ${avgStars}
            </div>
            <div style="color:var(--gold);">★★★★★</div>
          </div>
          <p style="font-size:12px; color:var(--text-muted); margin-top:6px;">
            累计收到 ${rating.review_count || 0} 条服务评价，好评率达 98.2%。
          </p>
        </div>

        <div style="background:var(--surface-block); border-radius:var(--radius-md); padding:12px; border:1px solid var(--line-subtle); margin-top:14px;">
          <div style="font-size:12px; color:var(--text-muted);">灵龙护航信誉分：</div>
          <div style="font-size:16px; font-weight:700; color:var(--success); margin-top:2px;">100 / 100 (极佳)</div>
        </div>
      </div>
    </div>

    <!-- 客户评价列表 -->
    <div class="table-panel">
      <div class="table-header-bar">
        <div class="table-header-title">老板最新评价 (${reviews.length} 条)</div>
      </div>
      <div style="padding:16px; display:flex; flex-direction:column; gap:10px;">
        ${reviews
          .map(
            (rev) => `
          <div style="background:var(--surface-block); border-radius:var(--radius-md); padding:12px; border:1px solid var(--line-subtle);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-weight:700; color:#fff;">${escapeHtml(rev.customer_name || rev.customer || '老板')}</span>
                ${(rev.tags || []).map(t => `<span class="tag-pill" style="font-size:10px;">${escapeHtml(t)}</span>`).join('')}
              </div>
              <span style="color:var(--gold); font-size:12px;">★ ${rev.stars} 星好评</span>
            </div>
            <div style="font-size:13px; color:var(--text-main); line-height:1.5;">${escapeHtml(rev.content || rev.comment || '服务非常满意！')}</div>
            <div style="font-size:11px; color:var(--text-dim); margin-top:6px;">${formatDate(rev.created_at)}</div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>

    <!-- 打赏清单 -->
    <div class="table-panel">
      <div class="table-header-bar">
        <div class="table-header-title">老板自愿打赏清单</div>
      </div>
      <div style="padding:16px; display:flex; flex-direction:column; gap:10px;">
        ${
          tips.length === 0
            ? '<div style="font-size:13px; color:var(--text-muted); text-align:center;">暂无打赏记录</div>'
            : tips
                .map(
                  (tip) => `
            <div style="background:var(--surface-block); border-radius:var(--radius-md); padding:12px; border:1px solid var(--line-subtle); display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:700; color:#fff;">${escapeHtml(tip.customer_name || tip.customer || '老板')} · 打赏赠礼</div>
                <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">${escapeHtml(tip.text || tip.message || '感谢魔王给力带飞')}</div>
              </div>
              <div style="font-size:18px; font-weight:800; color:var(--gold);">+¥${(tip.amount || 0).toFixed(2)}</div>
            </div>
          `
                )
                .join('')
        }
      </div>
    </div>
  `;

  document.getElementById('btn-view-notice')?.addEventListener('click', () => navigateTo('notice'));
}

/* ========================================================
   11. 页面六：打手须知 (Worker Notice View)
   ======================================================== */
async function renderNoticeView() {
  const container = document.getElementById('main-view-container');
  if (!container) return;

  if (!state.user) {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-title-group">
          <h1>📖 打手服务须知与公约手册</h1>
          <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">
            打手接单准则、安全保底规范与在线协议签署
          </p>
        </div>
      </div>
      <div class="empty-state">
        <div class="empty-icon">📖</div>
        <div style="font-size:16px; font-weight:700; color:#fff;">请先登录打手账号</div>
        <div style="font-size:13px; color:var(--text-muted); margin-top:4px;">
          登录后即可查阅当前生效的打手服务手册，并核验您的签署确认状态。
        </div>
        <button type="button" class="btn primary" id="btn-notice-empty-login" style="margin-top:14px;">
          <span>🔑</span> 登录打手账号
        </button>
      </div>
    `;
    document.getElementById('btn-notice-empty-login')?.addEventListener('click', showLoginModal);
    return;
  }

  // 若尚未加载打手须知，则即刻拉取
  if (!state.notice) {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-title-group">
          <h1>📖 打手服务须知与公约手册</h1>
          <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">正在连接云端核验最新打手须知与签署状态...</p>
        </div>
      </div>
      <div class="empty-state">
        <div class="empty-icon">⏳</div>
        <div style="font-size:14px; color:var(--text-muted);">正在加载打手须知数据...</div>
      </div>
    `;
    try {
      state.notice = await api.getWorkerNotice();
      updateBadges();
      renderNoticeView();
    } catch (e) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <div style="font-size:15px; color:var(--danger); font-weight:700;">获取打手须知失败</div>
          <div style="font-size:12px; color:var(--text-dim); margin-top:4px;">${escapeHtml(e.message || '网络连接异常')}</div>
          <button type="button" class="btn sm" id="btn-retry-notice" style="margin-top:12px;">重试加载</button>
        </div>
      `;
      document.getElementById('btn-retry-notice')?.addEventListener('click', () => {
        state.notice = null;
        renderNoticeView();
      });
    }
    return;
  }

  const notice = state.notice;
  const isAccepted = !!notice.accepted;
  const user = state.user;

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title-group">
        <h1>📖 打手服务须知与公约手册</h1>
        <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">
          灵龙打手履约准则、风控防假赛安全规范与在线服务法律协议
        </p>
      </div>
      <div class="page-actions">
        ${
          isAccepted
            ? `<span class="pill-badge" style="background:rgba(16,185,129,0.18); color:var(--success); font-size:12px; padding:6px 14px; font-weight:700;">✔ 已签署生效</span>`
            : `<span class="pill-badge" style="background:rgba(245,158,11,0.2); color:var(--warning); font-size:12px; padding:6px 14px; font-weight:700;">⚠️ 待确认签署</span>`
        }
      </div>
    </div>

    <div class="notice-container">
      <!-- 须知正文卡片 -->
      <div class="notice-card">
        <div class="notice-meta-bar">
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <span class="pill-badge vip" style="font-size:12px; padding:4px 10px;">版本 ${escapeHtml(notice.version || 'V4.0')}</span>
            <span style="font-size:14px; font-weight:700; color:#fff;">${escapeHtml(notice.title || '灵龙电竞打手服务须知')}</span>
          </div>
          <div style="font-size:11px; color:var(--text-dim); font-family:var(--font-mono);">
            SHA256: ${escapeHtml((notice.text_hash || '').slice(0, 16))}...
          </div>
        </div>

        <!-- 可滚动正文区 -->
        <div class="notice-scroll-box" id="notice-scroll-box" tabindex="0" aria-label="完整打手须知">
          <pre>${escapeHtml(notice.text || '暂无须知内容')}</pre>
          <div class="notice-end-marker">— 灵龙电竞 · 打手须知全文结束 —</div>
        </div>

        <!-- 滚动阅读状态提示 -->
        <div class="notice-read-status-bar">
          <span id="notice-read-status-text" style="color:${isAccepted || state.noticeRead ? 'var(--success)' : 'var(--warning)'}; font-weight:600;">
            ${
              isAccepted
                ? '✔ 您已完成签署，当前须知协议有效'
                : state.noticeRead
                ? '✅ 已完整阅读至末尾，可在下方进行签署确认。'
                : '⏳ 请向下滚动阅读至全文末尾以激活签署（未读完暂无法签署）'
            }
          </span>
          <span style="color:var(--text-dim); font-family:var(--font-mono);" id="notice-scroll-percent">
            ${isAccepted || state.noticeRead ? '100%' : '滚动检测中'}
          </span>
        </div>
      </div>

      <!-- 底部签署/凭据状态卡片 -->
      ${
        isAccepted
          ? `
            <div class="notice-receipt-card">
              <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:20px;">🛡️</span>
                  <span style="font-weight:700; color:var(--success); font-size:14px;">电子公约协议签署凭据已归档</span>
                </div>
                <span class="pill-badge" style="background:rgba(16,185,129,0.2); color:var(--success); font-size:11px;">具备平台管理合规效力</span>
              </div>
              <div class="notice-receipt-grid">
                <div class="notice-receipt-item">
                  <span class="label">签署打手</span>
                  <span class="val">${escapeHtml(user.nickname || user.username || '打手')} (${escapeHtml(user.username || '')})</span>
                </div>
                <div class="notice-receipt-item">
                  <span class="label">生效版本</span>
                  <span class="val">${escapeHtml(notice.version || 'V4.0')}</span>
                </div>
                <div class="notice-receipt-item">
                  <span class="label">签署确认时间</span>
                  <span class="val">${formatDate(notice.accepted_at || user.worker_notice_at)}</span>
                </div>
                <div class="notice-receipt-item">
                  <span class="label">防篡改指纹摘要</span>
                  <span class="val" title="${escapeHtml(notice.text_hash || '')}">${escapeHtml((notice.text_hash || 'SHA-256-OK').slice(0, 20))}...</span>
                </div>
              </div>
            </div>
          `
          : `
            <div class="notice-ack-card">
              <div style="font-weight:700; font-size:15px; color:#fff; margin-bottom:4px;">
                ✍️ 在线确认签署新版打手须知
              </div>
              <div style="font-size:12px; color:var(--text-muted); margin-bottom:16px;">
                根据平台风控与安全公约要求，请完整阅读上方条款至末尾，并在下方手动输入确认文字完成签署方可抢单。
              </div>

              <div class="form-group" style="text-align:left; margin-bottom:14px;">
                <label class="form-label" style="display:flex; align-items:center; justify-content:space-between;">
                  <span>1. 请手动输入确认语：<strong style="color:var(--primary);">${escapeHtml(notice.acknowledgement || '我已阅读新版须知内容')}</strong></span>
                  <button type="button" class="quick-fill-btn" id="btn-fill-ack" ${!state.noticeRead ? 'disabled' : ''}>一键填入</button>
                </label>
                <input type="text" class="form-input" id="input-notice-ack" placeholder="请阅读至末尾后输入：${escapeHtml(notice.acknowledgement || '我已阅读新版须知内容')}" ${!state.noticeRead ? 'disabled' : ''} />
              </div>

              <div class="form-group" style="text-align:left; margin-bottom:18px;">
                <label class="form-label" style="display:flex; align-items:center; justify-content:space-between;">
                  <span>2. 请额外输入成年接单确认语：<strong style="color:var(--primary);">我已年满18周岁，具备完全民事行为能力，确认继续接单</strong></span>
                  <button type="button" class="quick-fill-btn" id="btn-fill-adult" ${!state.noticeRead ? 'disabled' : ''}>一键填入</button>
                </label>
                <input type="text" class="form-input" id="input-adult-ack" placeholder="请输入：我已年满18周岁，具备完全民事行为能力，确认继续接单" ${!state.noticeRead ? 'disabled' : ''} />
              </div>

              <div style="display:flex; align-items:center; justify-content:flex-end; gap:12px;">
                <button type="button" class="btn primary" id="btn-submit-notice-ack" ${!state.noticeRead ? 'disabled' : ''}>
                  ✍️ 确认已读并签署协议
                </button>
              </div>
            </div>
          `
      }
    </div>
  `;

  // 绑定滚动监听与一键填入逻辑
  if (!isAccepted) {
    const scrollBox = document.getElementById('notice-scroll-box');
    const markReadAndUnlock = async () => {
      if (state.noticeRead || state.noticeReadPending) return;
      state.noticeReadPending = true;
      try {
        const token = state.notice?.read_token || notice.read_token;
        if (token) {
          await api.markWorkerNoticeRead(token);
        }
        state.noticeRead = true;
        const statusText = document.getElementById('notice-read-status-text');
        if (statusText) {
          statusText.textContent = '✅ 已完整阅读至末尾，可在下方进行签署确认。';
          statusText.style.color = 'var(--success)';
        }
        const percentEl = document.getElementById('notice-scroll-percent');
        if (percentEl) percentEl.textContent = '100%';

        const ackInput = document.getElementById('input-notice-ack');
        const adultInput = document.getElementById('input-adult-ack');
        const submitBtn = document.getElementById('btn-submit-notice-ack');
        const btnAck = document.getElementById('btn-fill-ack');
        const btnAdult = document.getElementById('btn-fill-adult');

        if (ackInput) ackInput.disabled = false;
        if (adultInput) adultInput.disabled = false;
        if (submitBtn) submitBtn.disabled = false;
        if (btnAck) btnAck.disabled = false;
        if (btnAdult) btnAdult.disabled = false;
      } catch (e) {
        console.warn('markWorkerNoticeRead error:', e);
        if (e.message && (e.message.includes('过期') || e.message.includes('重新'))) {
          showToast('须知页面凭证已更新，请重新滚动到底部', 'warning');
          state.notice = null;
          state.noticeRead = false;
          setTimeout(() => renderNoticeView(), 800);
        }
      } finally {
        state.noticeReadPending = false;
      }
    };

    if (scrollBox) {
      if (scrollBox.scrollHeight <= scrollBox.clientHeight + 20) {
        markReadAndUnlock();
      } else {
        scrollBox.addEventListener('scroll', () => {
          const atBottom = scrollBox.scrollTop + scrollBox.clientHeight >= scrollBox.scrollHeight - 20;
          const progress = Math.min(100, Math.round(((scrollBox.scrollTop + scrollBox.clientHeight) / scrollBox.scrollHeight) * 100));
          const percentEl = document.getElementById('notice-scroll-percent');
          if (percentEl && !state.noticeRead) percentEl.textContent = `${progress}%`;

          if (atBottom) {
            markReadAndUnlock();
          }
        });
      }
    }

    // 快捷填入
    document.getElementById('btn-fill-ack')?.addEventListener('click', () => {
      const input = document.getElementById('input-notice-ack');
      if (input) {
        input.value = notice.acknowledgement || '我已阅读新版须知内容';
        input.focus();
      }
    });

    document.getElementById('btn-fill-adult')?.addEventListener('click', () => {
      const input = document.getElementById('input-adult-ack');
      if (input) {
        input.value = '我已年满18周岁，具备完全民事行为能力，确认继续接单';
        input.focus();
      }
    });

    // 提交签署
    document.getElementById('btn-submit-notice-ack')?.addEventListener('click', async () => {
      const ackVal = document.getElementById('input-notice-ack')?.value.trim();
      const adultVal = document.getElementById('input-adult-ack')?.value.trim();

      const requiredAck = notice.acknowledgement || '我已阅读新版须知内容';
      const requiredAdult = '我已年满18周岁，具备完全民事行为能力，确认继续接单';

      if (ackVal !== requiredAck) {
        showToast(`请完整输入确认文字：“${requiredAck}”`, 'error');
        return;
      }

      if (adultVal !== requiredAdult) {
        showToast(`请完整输入成年确认文字：“${requiredAdult}”`, 'error');
        return;
      }

      const submitBtn = document.getElementById('btn-submit-notice-ack');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '正在提交签署凭据...';
      }

      try {
        const token = state.notice?.read_token || notice.read_token;
        const res = await api.acceptWorkerNotice(token, ackVal, adultVal);
        soundEngine.playSuccessChime();
        showToast('打手须知签署成功！已激活完整接单权益', 'success');

        // 更新状态
        state.notice = {
          ...state.notice,
          accepted: true,
          accepted_at: new Date().toISOString()
        };
        if (res?.user) {
          state.user = { ...state.user, ...res.user };
        }

        updateBadges();
        renderNoticeView();
        refreshData(true);
      } catch (err) {
        showToast(err.message || '签署提交失败，请重试', 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = '✍️ 确认已读并签署协议';
        }
        if (err.message && (err.message.includes('过期') || err.message.includes('更新') || err.message.includes('重新'))) {
          setTimeout(async () => {
            state.notice = null;
            state.noticeRead = false;
            state.noticeReadPending = false;
            await renderNoticeView();
          }, 1200);
        }
      }
    });
  }
}

/* ========================================================
   11. 页面六：客户端设置 (Settings View & FlClash Sub-Nav)
   ======================================================== */
function renderSettingsView() {
  const container = document.getElementById('main-view-container');
  if (!container) return;

  state.settingsTab = state.settingsTab || localStorage.getItem('ll_settings_tab') || 'sound';
  const activeTab = state.settingsTab;

  const currentVolumePercent = Math.round(soundEngine.volume * 100);
  const currentSpeed = soundEngine.speechRate.toFixed(2);

  // 1. 顶部 Header 与 FlClash 分段控制器子导航
  container.innerHTML = `
    <div class="page-header" style="margin-bottom:16px;">
      <div class="page-title-group">
        <h1>⚙️ 客户端设置</h1>
        <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">
          管理大厅来单音效、老板指名语音播报、客户端版本检测与服务器网络连接
        </p>
      </div>
    </div>

    <!-- FlClash 分段控制器子导航 (Sub-Nav Tabs) -->
    <div class="settings-subnav">
      <button type="button" class="settings-subnav-btn ${activeTab === 'sound' ? 'active' : ''}" data-tab="sound">
        <span>🔔</span> 来单音效
      </button>
      <button type="button" class="settings-subnav-btn ${activeTab === 'speech' ? 'active' : ''}" data-tab="speech">
        <span>🗣️</span> 语音播报
      </button>
      <button type="button" class="settings-subnav-btn ${activeTab === 'update' ? 'active' : ''}" data-tab="update">
        <span>🚀</span> 版本更新
      </button>
      <button type="button" class="settings-subnav-btn ${activeTab === 'network' ? 'active' : ''}" data-tab="network">
        <span>🌐</span> 网络连接
      </button>
    </div>

    <!-- 对应 Tab 内容面板 -->
    <div class="settings-panel" id="settings-tab-content">
      ${renderSettingsTabContent(activeTab, currentVolumePercent, currentSpeed)}
    </div>
  `;

  // 绑定子导航切换
  container.querySelectorAll('.settings-subnav-btn[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      state.settingsTab = tab;
      localStorage.setItem('ll_settings_tab', tab);
      renderSettingsView();
    });
  });

  // 绑定对应面板内的交互事件
  bindSettingsTabEvents(activeTab);
}

// 渲染各 Tab 专属面板 HTML
function renderSettingsTabContent(tab, volumePercent, currentSpeed) {
  if (tab === 'sound') {
    // === Tab 1: 来单音效 ===
    const soundIcons = {
      classic: '🎵',
      radar: '📡',
      crystal: '💧',
      urgent: '⚠️',
      chord: '🎹',
      custom: '📁'
    };

    return `
      <!-- 来单提示音总开关卡片 -->
      <div class="settings-card">
        <div class="settings-card-header">
          <div>
            <div class="settings-card-title">
              <span>🔔</span> 接单大厅来单提示音
            </div>
            <div class="settings-card-desc">
              当接单大厅出现新发布的订单时播放提示音，支持 5 种高质感电竞预设及本机自定义音频
            </div>
          </div>
          <div class="fl-switch ${soundEngine.enabled ? 'active' : ''}" id="switch-sound-enabled" title="点击开关">
            <div class="fl-switch-thumb"></div>
          </div>
        </div>

        <!-- 音量滑块与快捷预设 -->
        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-item-info">
              <div class="settings-item-title">
                <span>🔊</span> 提示音与语音主音量
              </div>
              <div class="settings-item-desc">
                调节全局提示音、结算和弦音及 TTS 语音播报音量（可点选下方快捷档位）
              </div>
              <div class="preset-chips-row">
                <button type="button" class="preset-chip ${volumePercent === 0 ? 'active' : ''}" data-vol="0">静音 (0%)</button>
                <button type="button" class="preset-chip ${volumePercent === 35 ? 'active' : ''}" data-vol="35">轻柔 (35%)</button>
                <button type="button" class="preset-chip ${volumePercent === 70 ? 'active' : ''}" data-vol="70">标准 (70%)</button>
                <button type="button" class="preset-chip ${volumePercent === 100 ? 'active' : ''}" data-vol="100">洪亮 (100%)</button>
              </div>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
              <div class="fl-slider-container">
                <input type="range" class="fl-slider" id="slider-sound-volume" min="0" max="100" value="${volumePercent}" />
                <span class="slider-val-badge" id="badge-volume-val">${volumePercent}%</span>
              </div>
              <button type="button" class="btn sm" id="btn-test-current-vol" style="font-size:11px; padding:4px 10px;">
                <span>🎧</span> 测试当前音量
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 音效方案选择库 -->
      <div class="settings-card">
        <div class="settings-card-header">
          <div>
            <div class="settings-card-title">
              <span>🎵</span> 来单音效方案库
            </div>
            <div class="settings-card-desc">
              轻点卡片即刻生效，点击试听按钮可实时预览音色效果
            </div>
          </div>
          <span class="pill-badge primary" style="font-size:11px;">已生效：${escapeHtml(SOUND_PROFILES.find(p => p.id === soundEngine.soundProfile)?.name || '经典三阶')}</span>
        </div>

        <div class="sound-profile-grid">
          ${SOUND_PROFILES.map((p) => {
            const isActive = soundEngine.soundProfile === p.id;
            const icon = soundIcons[p.id] || '🎵';
            return `
              <div class="sound-profile-card ${isActive ? 'active' : ''}" data-profile-id="${p.id}">
                <div class="sound-profile-icon">${icon}</div>
                <div class="sound-profile-content">
                  <div class="sound-profile-title">
                    <span>${escapeHtml(p.name)}</span>
                    ${isActive ? '<span style="font-size:11px; color:var(--primary); font-weight:normal;">[当前使用]</span>' : ''}
                  </div>
                  <div class="sound-profile-desc">${escapeHtml(p.desc)}</div>
                </div>
                <button type="button" class="sound-audition-btn" data-audition="${p.id}" title="试听此音效">
                  <span>🎧</span> 试听
                </button>
              </div>
            `;
          }).join('')}
        </div>

        <!-- 本地自定义音频上传扩展区 -->
        ${
          soundEngine.soundProfile === 'custom'
            ? `
              <div class="custom-audio-box" style="margin-top:16px;">
                <div style="display:flex; align-items:center; gap:12px;">
                  <span style="font-size:24px;">📁</span>
                  <div>
                    <div style="font-size:13px; font-weight:700; color:#fff;">
                      当前已载入本地音频: <span style="color:var(--primary); font-family:var(--font-mono);">${escapeHtml(soundEngine.customSoundName || '尚未载入本地音频')}</span>
                    </div>
                    <div style="font-size:12px; color:var(--text-dim); margin-top:2px;">
                      支持导入本机 MP3 / WAV / OGG 音效（大小建议不超过 2MB，自动持久化存储）
                    </div>
                  </div>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                  <input type="file" id="input-custom-audio" accept="audio/*" style="display:none;" />
                  <button type="button" class="btn primary sm" id="btn-select-audio">
                    <span>📂</span> 选取本机音频
                  </button>
                  ${
                    soundEngine.customSoundData
                      ? `
                        <button type="button" class="btn sm" id="btn-clear-custom-audio" style="color:var(--danger);">
                          <span>🗑️</span> 清除自定义音频
                        </button>
                      `
                      : ''
                  }
                </div>
              </div>
            `
            : ''
        }
      </div>
    `;
  }

  if (tab === 'speech') {
    // === Tab 2: 语音播报 ===
    const currentPitch = soundEngine.speechPitch.toFixed(2);
    return `
      <!-- 1. 播报总控卡片 -->
      <div class="settings-card">
        <div class="settings-card-header">
          <div>
            <div class="settings-card-title">
              <span>🎯</span> 老板指名专属订单 TTS 智能语音播报
            </div>
            <div class="settings-card-desc">
              当雇主指名您或出现专属订单时，智能朗读具体订单分区、模式及收益金额，抢单快人一步
            </div>
          </div>
          <div class="fl-switch ${soundEngine.speechDesignated ? 'active' : ''}" id="switch-speech-designated" title="点击开关">
            <div class="fl-switch-thumb"></div>
          </div>
        </div>

        <div class="settings-group">
          <!-- 普通大厅订单播报开关 -->
          <div class="settings-item">
            <div class="settings-item-info">
              <div class="settings-item-title">
                <span>📢</span> 普通大厅订单全员语音播报
              </div>
              <div class="settings-item-desc">
                朗读接单大厅所有新发布的普通订单（默认保持关闭，避免接单高峰期频繁提示打扰耳机）
              </div>
            </div>
            <div class="fl-switch ${soundEngine.speechGeneral ? 'active' : ''}" id="switch-speech-general" title="点击开关">
              <div class="fl-switch-thumb"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. 老板指名播报风格方案选择库 (共 5 款风格) -->
      <div class="settings-card">
        <div class="settings-card-header">
          <div>
            <div class="settings-card-title">
              <span>🎭</span> 老板指名播报文案风格库 (5款专属方案)
            </div>
            <div class="settings-card-desc">
              针对不同对局场景与打手偏好定制多样化台词。轻点卡片即可切换选用，点击“试听”可实时体验发音效果。
            </div>
          </div>
        </div>

        <div class="speech-scheme-grid">
          ${SPEECH_SCHEMES.map((scheme) => {
            const isActive = soundEngine.speechScheme === scheme.id;
            return `
              <div class="speech-scheme-card ${isActive ? 'active' : ''}" data-scheme-id="${scheme.id}">
                <div class="speech-scheme-header">
                  <div class="speech-scheme-title-wrap">
                    <div class="speech-scheme-icon">${scheme.icon}</div>
                    <div>
                      <div class="speech-scheme-name">
                        <span>${escapeHtml(scheme.name)}</span>
                        <span class="speech-scheme-badge">${escapeHtml(scheme.badge)}</span>
                      </div>
                      <div class="speech-scheme-tagline">${escapeHtml(scheme.tagline)}</div>
                    </div>
                  </div>
                  ${isActive ? `<span class="pill-badge" style="background:rgba(16,185,129,0.2); color:var(--success); font-size:11px; padding:3px 8px; font-weight:700;">✔ 当前选用</span>` : ''}
                </div>

                <div class="speech-scheme-desc">${escapeHtml(scheme.desc)}</div>

                <!-- 台词预览框 -->
                <div class="speech-preview-quote">
                  “${escapeHtml(scheme.demoText)}”
                </div>

                <div class="speech-scheme-footer">
                  <span style="font-size:11px; color:var(--text-dim);">
                    ${isActive ? '● 当前播报使用此台词' : '○ 点击此卡片选用'}
                  </span>
                  <button type="button" class="speech-audition-btn" data-audition-scheme="${scheme.id}">
                    <span>🗣️</span> 试听方案台词
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 3. 播报要素与主播隐私保护开关 -->
      <div class="settings-card">
        <div class="settings-card-header">
          <div>
            <div class="settings-card-title">
              <span>🛡️</span> 播报要素与隐私保护设置
            </div>
            <div class="settings-card-desc">
              自主控制语音朗读包含的要素内容。针对主播对局、直播连麦或防窥探场景提供一键隐蔽支持。
            </div>
          </div>
        </div>

        <div class="settings-group">
          <!-- 播报收益金额开关 -->
          <div class="settings-item">
            <div class="settings-item-info">
              <div class="settings-item-title">
                <span>💰</span> 播报具体订单收益金额
              </div>
              <div class="settings-item-desc">
                开启后语音朗读订单具体预计报酬（如“收益 480 元”）。若在直播间或与老板连麦，建议关闭此项以隐藏收益防窥探。
              </div>
            </div>
            <div class="fl-switch ${soundEngine.speechIncludeAmount ? 'active' : ''}" id="switch-speech-amount" title="点击开关">
              <div class="fl-switch-thumb"></div>
            </div>
          </div>

          <!-- 播报游戏分区开关 -->
          <div class="settings-item">
            <div class="settings-item-info">
              <div class="settings-item-title">
                <span>🎮</span> 播报游戏分类与模式
              </div>
              <div class="settings-item-desc">
                开启后语音先播报游戏名称（如“端游三角洲”、“手游三角洲”）；关闭后直接播报任务核心。
              </div>
            </div>
            <div class="fl-switch ${soundEngine.speechIncludeDivision ? 'active' : ''}" id="switch-speech-division" title="点击开关">
              <div class="fl-switch-thumb"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. 语速与音调韵律微调卡片 -->
      <div class="settings-card">
        <div class="settings-card-header">
          <div>
            <div class="settings-card-title">
              <span>⚡</span> 发音语速与音调微调
            </div>
            <div class="settings-card-desc">
              调节 Windows 原生中文 TTS 引擎发音速度与音高（语速推荐 1.00x - 1.15x，平衡自然度与时效性）
            </div>
          </div>
        </div>

        <div class="settings-group">
          <!-- 语速滑块调节 -->
          <div class="settings-item">
            <div class="settings-item-info">
              <div class="settings-item-title">
                <span>🎚️</span> 语音朗读语速
              </div>
              <div class="preset-chips-row">
                <button type="button" class="preset-chip ${currentSpeed === '0.50' ? 'active' : ''}" data-speed="50">0.5x</button>
                <button type="button" class="preset-chip ${currentSpeed === '1.00' ? 'active' : ''}" data-speed="100">1.0x (标准)</button>
                <button type="button" class="preset-chip ${currentSpeed === '1.50' ? 'active' : ''}" data-speed="150">1.5x</button>
                <button type="button" class="preset-chip ${currentSpeed === '2.00' ? 'active' : ''}" data-speed="200">2.0x</button>
                <button type="button" class="preset-chip ${currentSpeed === '3.00' ? 'active' : ''}" data-speed="300">3.0x (飞速)</button>
              </div>
            </div>
            <div class="fl-slider-container">
              <input type="range" class="fl-slider" id="slider-speech-rate" min="50" max="300" step="5" value="${Math.round(soundEngine.speechRate * 100)}" />
              <span class="slider-val-badge" id="badge-speech-rate">${currentSpeed}x</span>
            </div>
          </div>

          <!-- 音调滑块调节 -->
          <div class="settings-item">
            <div class="settings-item-info">
              <div class="settings-item-title">
                <span>🎶</span> 语音音调 (高低音)
              </div>
              <div class="preset-chips-row">
                <button type="button" class="preset-chip ${currentPitch === '0.85' ? 'active' : ''}" data-pitch="85">深沉 (0.85)</button>
                <button type="button" class="preset-chip ${currentPitch === '1.00' ? 'active' : ''}" data-pitch="100">自然 (1.00)</button>
                <button type="button" class="preset-chip ${currentPitch === '1.15' ? 'active' : ''}" data-pitch="115">清脆 (1.15)</button>
              </div>
            </div>
            <div class="fl-slider-container">
              <input type="range" class="fl-slider" id="slider-speech-pitch" min="70" max="130" value="${Math.round(soundEngine.speechPitch * 100)}" />
              <span class="slider-val-badge" id="badge-speech-pitch">${currentPitch}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  if (tab === 'update') {
    // === Tab 3: 版本更新 ===
    return `
      <!-- 版本与更新检测卡片 -->
      <div class="settings-card">
        <div class="settings-card-header">
          <div style="display:flex; align-items:center; gap:16px;">
            <img src="assets/brand.png" style="width:52px; height:52px; border-radius:var(--radius-lg); object-fit:contain;" alt="灵龙电竞" />
            <div>
              <div class="settings-card-title" style="font-size:16px;">
                灵龙电竞接单助手 Windows 原生客户端
              </div>
              <div class="settings-card-desc">
                当前运行版本：<strong style="color:var(--primary); font-family:var(--font-mono); font-size:13px;">v${CLIENT_VERSION}</strong> · 生产正式版
              </div>
            </div>
          </div>
          <button type="button" class="btn primary" id="btn-check-update-manual" ${state.updateChecking ? 'disabled' : ''} style="padding:10px 20px;">
            <span>${state.updateChecking ? '⏳' : '🔄'}</span>
            <span>${state.updateChecking ? '正在检测更新...' : '立即检查更新'}</span>
          </button>
        </div>

        <div class="settings-group">
          <!-- 自动更新检测开关 -->
          <div class="settings-item">
            <div class="settings-item-info">
              <div class="settings-item-title">
                <span>🚀</span> 启动时静默自动检测更新
              </div>
              <div class="settings-item-desc">
                客户端每次启动时在后台静默请求云端版本服务，发现新版本时弹窗提示，不影响日常抢单
              </div>
            </div>
            <div class="fl-switch ${state.autoUpdateEnabled ? 'active' : ''}" id="switch-auto-update" title="点击开关">
              <div class="fl-switch-thumb"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 客户端作者与客服支持 -->
      <div class="settings-card">
        <div class="settings-card-header">
          <div class="settings-card-title">
            <span>ℹ️</span> 官方客服支持
          </div>
        </div>
        <div style="padding:16px 20px; background:var(--surface-block); border-radius:var(--radius-md); border:1px solid var(--line-subtle); display:flex; flex-direction:column; gap:8px; font-size:13px; line-height:1.7;">
          <div style="color:#fff; font-weight:600; display:flex; align-items:center; gap:8px;">
            <span style="color:var(--text-muted);">客户端作者：</span>
            <span style="color:var(--primary); font-family:var(--font-mono); font-size:14px; font-weight:700;">CreatryCat</span>
          </div>
          <div style="color:#fff; font-weight:600; display:flex; align-items:center; gap:8px;">
            <span style="color:var(--text-muted);">联系QQ：</span>
            <span style="color:var(--success); font-family:var(--font-mono); font-size:14px; font-weight:700;">2097764829</span>
          </div>
        </div>
      </div>
    `;
  }

  if (tab === 'network') {
    // === Tab 4: 网络连接 ===
    const isProd = api.baseUrl.includes('linglong.club');
    const isLocal = api.baseUrl.includes('127.0.0.1') || api.baseUrl.includes('localhost');

    return `
      <!-- 云端服务连接状态卡片 -->
      <div class="settings-card">
        <div class="settings-card-header">
          <div>
            <div class="settings-card-title">
              <span>🌐</span> 灵龙云端服务连接状态
            </div>
            <div class="settings-card-desc">
              客户端与灵龙云端网关的实时通信协议与长连接状态
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="live-indicator" style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--success); box-shadow:0 0 8px var(--success);"></span>
            <span style="font-size:12px; color:var(--success); font-weight:700;">正常已连接</span>
          </div>
        </div>

        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-item-info">
              <div class="settings-item-title">
                <span>⚡</span> 实时网络延迟
              </div>
              <div class="settings-item-desc">
                雨云高防 BGP 多线接入节点到客户端的平均往返心跳延时
              </div>
            </div>
            <span class="pill-badge success" style="font-family:var(--font-mono); font-size:13px; font-weight:700; padding:6px 14px;">
              ${state.latency || 54} ms
            </span>
          </div>
        </div>
      </div>

      <!-- 服务器地址配置卡片 -->
      <div class="settings-card">
        <div class="settings-card-header">
          <div>
            <div class="settings-card-title">
              <span>⚙️</span> 后端 API 服务地址配置
            </div>
            <div class="settings-card-desc">
              支持一键切换生产云端服务器或本地调试开发环境
            </div>
          </div>
        </div>

        <div class="settings-group">
          <div>
            <label class="form-label">快速预设网络节点</label>
            <div class="preset-chips-row" style="margin-top:4px; margin-bottom:14px;">
              <button type="button" class="preset-chip ${isProd ? 'active' : ''}" id="btn-preset-prod">
                ☁️ 雨云官方生产服务 (https://www.linglong.club)
              </button>
              <button type="button" class="preset-chip ${isLocal ? 'active' : ''}" id="btn-preset-local">
                💻 本地开发测试环境 (http://127.0.0.1:3000)
              </button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">后端 API 完整地址</label>
            <div style="display:flex; gap:12px;">
              <input type="text" class="form-input" id="settings-api-host" value="${api.baseUrl}" style="flex:1;" />
              <button type="button" class="btn primary" id="btn-save-host">保存并连接</button>
            </div>
            <span style="font-size:11px; color:var(--text-dim); margin-top:6px;">
              提示：生产环境必须使用 HTTPS 协议，以确保打手登录 Cookie 会话与资金结算安全。
            </span>
          </div>
        </div>
      </div>
    `;
  }

  return '';
}

// 绑定当前 Tab 内部交互事件
function bindSettingsTabEvents(tab) {
  if (tab === 'sound') {
    // 1. 来单提示音开关
    document.getElementById('switch-sound-enabled')?.addEventListener('click', () => {
      const enabled = soundEngine.toggleSound();
      state.soundMuted = !enabled;
      updateAudioButtonUI();
      renderSettingsView();
      showToast(enabled ? '大厅来单提示音已开启' : '大厅来单提示音已静音', enabled ? 'success' : 'info');
    });

    // 2. 音量滑块
    const volumeSlider = document.getElementById('slider-sound-volume');
    volumeSlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      const badge = document.getElementById('badge-volume-val');
      if (badge) badge.textContent = `${val}%`;
      soundEngine.setVolume(val / 100);
    });
    volumeSlider?.addEventListener('change', () => {
      soundEngine.playOrderPings();
    });

    // 3. 音量快捷预设档位
    document.querySelectorAll('.preset-chip[data-vol]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const vol = parseInt(chip.getAttribute('data-vol'), 10);
        soundEngine.setVolume(vol / 100);
        soundEngine.playOrderPings();
        renderSettingsView();
      });
    });

    // 4. 测试当前音量
    document.getElementById('btn-test-current-vol')?.addEventListener('click', () => {
      soundEngine.playOrderPings();
    });

    // 5. 音效卡片选择与试听
    document.querySelectorAll('.sound-profile-card[data-profile-id]').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.sound-audition-btn')) return;
        const pid = card.getAttribute('data-profile-id');
        soundEngine.setSoundProfile(pid);
        soundEngine.playOrderPings(pid);
        renderSettingsView();
      });
    });

    document.querySelectorAll('.sound-audition-btn[data-audition]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pid = btn.getAttribute('data-audition');
        soundEngine.playOrderPings(pid);
      });
    });

    // 6. 自定义本地音频选取
    document.getElementById('btn-select-audio')?.addEventListener('click', () => {
      document.getElementById('input-custom-audio')?.click();
    });

    const fileInput = document.getElementById('input-custom-audio');
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        showToast('音频文件过大，请选取 2MB 以内的 MP3/WAV/OGG 文件', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        soundEngine.setCustomSound(evt.target.result, file.name);
        showToast(`已成功载入本地音效：“${file.name}”`, 'success');
        soundEngine.playOrderPings('custom');
        renderSettingsView();
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('btn-clear-custom-audio')?.addEventListener('click', () => {
      soundEngine.clearCustomSound();
      showToast('已清除自定义音频并恢复为经典音效', 'info');
      renderSettingsView();
    });
  }

  if (tab === 'speech') {
    // 1. 专属指名语音总开关
    document.getElementById('switch-speech-designated')?.addEventListener('click', () => {
      const val = soundEngine.toggleSpeechDesignated();
      renderSettingsView();
      showToast(val ? '专属指名订单语音播报已开启' : '专属指名订单语音播报已关闭', val ? 'success' : 'info');
    });

    // 2. 普通大厅语音开关
    document.getElementById('switch-speech-general')?.addEventListener('click', () => {
      const val = soundEngine.toggleSpeechGeneral();
      renderSettingsView();
      showToast(val ? '普通大厅来单全员语音播报已开启' : '普通大厅来单全员语音播报已关闭', val ? 'success' : 'info');
    });

    // 3. 播报收益金额开关
    document.getElementById('switch-speech-amount')?.addEventListener('click', () => {
      const val = soundEngine.toggleSpeechIncludeAmount();
      renderSettingsView();
      showToast(val ? '已开启订单收益金额语音朗读' : '已关闭订单收益金额朗读（隐私隐蔽保护已生效）', val ? 'success' : 'info');
      soundEngine.testDesignatedSpeech();
    });

    // 4. 播报游戏分区开关
    document.getElementById('switch-speech-division')?.addEventListener('click', () => {
      const val = soundEngine.toggleSpeechIncludeDivision();
      renderSettingsView();
      showToast(val ? '已开启游戏分区模式语音朗读' : '已关闭游戏分区朗读', val ? 'success' : 'info');
      soundEngine.testDesignatedSpeech();
    });

    // 5. 播报风格方案选择与试听
    document.querySelectorAll('.speech-scheme-card[data-scheme-id]').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.speech-audition-btn')) return;
        const sid = card.getAttribute('data-scheme-id');
        soundEngine.setSpeechScheme(sid);
        soundEngine.testDesignatedSpeech(sid);
        renderSettingsView();
        const schemeObj = SPEECH_SCHEMES.find((s) => s.id === sid);
        showToast(`已切换为【${schemeObj?.name || sid}】播报方案`, 'success');
      });
    });

    document.querySelectorAll('.speech-audition-btn[data-audition-scheme]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sid = btn.getAttribute('data-audition-scheme');
        soundEngine.testDesignatedSpeech(sid);
      });
    });

    // 6. 语速滑块调节
    const speedSlider = document.getElementById('slider-speech-rate');
    speedSlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      const speed = (val / 100).toFixed(2);
      const badge = document.getElementById('badge-speech-rate');
      if (badge) badge.textContent = `${speed}x`;
      soundEngine.setSpeechRate(val / 100);
    });
    speedSlider?.addEventListener('change', () => {
      soundEngine.testDesignatedSpeech();
    });

    // 7. 语速快捷预设
    document.querySelectorAll('.preset-chip[data-speed]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const val = parseInt(chip.getAttribute('data-speed'), 10);
        soundEngine.setSpeechRate(val / 100);
        soundEngine.testDesignatedSpeech();
        renderSettingsView();
      });
    });

    // 8. 音调滑块调节
    const pitchSlider = document.getElementById('slider-speech-pitch');
    pitchSlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      const pitch = (val / 100).toFixed(2);
      const badge = document.getElementById('badge-speech-pitch');
      if (badge) badge.textContent = pitch;
      soundEngine.setSpeechPitch(val / 100);
    });
    pitchSlider?.addEventListener('change', () => {
      soundEngine.testDesignatedSpeech();
    });

    // 9. 音调快捷预设
    document.querySelectorAll('.preset-chip[data-pitch]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const val = parseInt(chip.getAttribute('data-pitch'), 10);
        soundEngine.setSpeechPitch(val / 100);
        soundEngine.testDesignatedSpeech();
        renderSettingsView();
      });
    });
  }

  if (tab === 'update') {
    // 1. 自动检测更新开关
    document.getElementById('switch-auto-update')?.addEventListener('click', () => {
      state.autoUpdateEnabled = !state.autoUpdateEnabled;
      localStorage.setItem('ll_auto_update', String(state.autoUpdateEnabled));
      renderSettingsView();
      showToast(state.autoUpdateEnabled ? '启动时自动检测更新已开启' : '启动时自动检测更新已关闭', 'info');
    });

    // 2. 手动立即检测更新
    document.getElementById('btn-check-update-manual')?.addEventListener('click', async () => {
      await checkAppUpdate(false);
    });
  }

  if (tab === 'network') {
    // 1. 快捷填入生产环境
    document.getElementById('btn-preset-prod')?.addEventListener('click', () => {
      const input = document.getElementById('settings-api-host');
      if (input) input.value = 'https://www.linglong.club';
    });

    // 2. 快捷填入本地环境
    document.getElementById('btn-preset-local')?.addEventListener('click', () => {
      const input = document.getElementById('settings-api-host');
      if (input) input.value = 'http://127.0.0.1:3000';
    });

    // 3. 保存 Host
    document.getElementById('btn-save-host')?.addEventListener('click', () => {
      const host = document.getElementById('settings-api-host')?.value.trim();
      if (host) {
        api.setBaseUrl(host);
        showToast('服务器地址已更新', 'success');
        refreshData();
        renderSettingsView();
      }
    });
  }
}
/* ========================================================
   12. 登录模态框系统 (Login Modal)
   ======================================================== */
function showLoginModal() {
  showConfirmModal({
    title: '灵龙电竞 · 打手平台登录',
    body: `
      <div style="display:flex; flex-direction:column; gap:14px; text-align:center;">
        <img src="./assets/brand.webp" style="width:58px; height:58px; margin:0 auto; border-radius:var(--radius-lg); box-shadow:0 6px 16px rgba(72,205,245,0.3);" alt="灵龙电竞" />
        <p style="font-size:13px; color:var(--text-muted);">
          请输入灵龙打手账号进行鉴权登录，开启抢单与实时收益同步。
        </p>

        <div class="form-group" style="text-align:left;">
          <label class="form-label">打手账号 / 手机号</label>
          <input type="text" class="form-input" id="login-username" placeholder="输入打手账号" value="" autofocus />
        </div>

        <div class="form-group" style="text-align:left;">
          <label class="form-label">登录密码</label>
          <input type="password" class="form-input" id="login-password" placeholder="输入密码" value="" />
        </div>
      </div>
    `,
    confirmText: '登 录',
    onConfirm: async () => {
      const u = document.getElementById('login-username')?.value.trim();
      const p = document.getElementById('login-password')?.value.trim();

      if (!u || !p) {
        showToast('请输入账号和密码', 'error');
        return;
      }

      try {
        const data = await api.login(u, p);
        state.user = data?.user || api.user;
        soundEngine.playSuccessChime();
        showToast(`欢迎回来，${api.user?.nickname || '打手'}！`, 'success');
        closeModal();
        updateSidebarUser();
        await refreshData();
        renderCurrentPage();
      } catch (e) {
        showToast(e.message || '登录失败，请检查账号密码', 'error');
      }
    }
  });

  setTimeout(() => {
    const uInput = document.getElementById('login-username');
    const pInput = document.getElementById('login-password');
    const handleEnter = (e) => {
      if (e.key === 'Enter') {
        document.getElementById('modal-confirm-btn')?.click();
      }
    };
    uInput?.addEventListener('keydown', handleEnter);
    pInput?.addEventListener('keydown', handleEnter);
    uInput?.focus();
  }, 60);
}

/* ========================================================
   13. 通用模态弹窗系统 (Modal System)
   ======================================================== */
let activeModalConfirmCallback = null;

function showConfirmModal({ title, body, confirmText = '确认', cancelText = '取消', onConfirm }) {
  const overlay = document.getElementById('modal-overlay');
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');
  const confirmBtn = document.getElementById('modal-confirm-btn');
  const cancelBtn = document.getElementById('modal-cancel-btn');

  if (!overlay || !bodyEl) return;

  if (titleEl) titleEl.textContent = title || '操作确认';
  bodyEl.innerHTML = body || '';
  if (confirmBtn) confirmBtn.textContent = confirmText;
  if (cancelBtn) cancelBtn.textContent = cancelText;

  activeModalConfirmCallback = onConfirm;

  // 重新绑定确认点击
  confirmBtn.onclick = async () => {
    if (activeModalConfirmCallback) {
      await activeModalConfirmCallback();
    } else {
      closeModal();
    }
  };

  overlay.classList.add('active');
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.remove('active');
  activeModalConfirmCallback = null;
}

/* ========================================================
   14. Toast 消息通知系统
   ======================================================== */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 2800);
}

/* ========================================================
   15. 辅助函数：时间计算与格式化
   ======================================================== */
function updateElapsedTimers() {
  const els = document.querySelectorAll('.order-time-elapsed[data-created]');
  els.forEach((el) => {
    const created = el.getAttribute('data-created');
    el.textContent = getElapsedTimeString(created);
  });
}

function getElapsedTimeString(dateStr) {
  if (!dateStr) return '刚刚';
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffSec < 60) return `已等待 ${diffSec}秒`;
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  return `已等待 ${mins}分${secs}秒`;
}

function checkIsUrgent(dateStr) {
  if (!dateStr) return false;
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  return diffSec >= 600; // 超 10 分钟
}

function formatDate(dateStr) {
  if (!dateStr) return '刚刚';
  try {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return dateStr;
  }
}

function formatStatus(status) {
  const map = {
    open: '待抢单',
    matched: '服务中',
    in_progress: '履约中',
    completed: '已结算',
    transferred: '已转单',
    cancelled: '已取消'
  };
  return map[status] || status;
}

function getStatusBg(status) {
  if (status === 'completed') return 'rgba(16, 185, 129, 0.15)';
  if (status === 'matched' || status === 'in_progress') return 'rgba(72, 205, 245, 0.15)';
  return 'rgba(255, 255, 255, 0.05)';
}

function getStatusColor(status) {
  if (status === 'completed') return 'var(--success)';
  if (status === 'matched' || status === 'in_progress') return 'var(--primary)';
  return 'var(--text-muted)';
}

function formatLedgerKind(kind) {
  const map = {
    order: '对局佣金',
    order_settle: '对局佣金',
    tip: '老板打赏',
    withdraw: '提现出金',
    withdrawal: '提现出金',
    deposit: '保证金'
  };
  return map[kind] || kind || '资金变动';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.navigateTo = navigateTo;
window.state = state;
window.api = api;
window.showLoginModal = showLoginModal;
window.soundEngine = soundEngine;
window.renderSettingsView = renderSettingsView;
window.closeModal = closeModal;
