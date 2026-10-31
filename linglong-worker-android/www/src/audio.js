// 灵龙电竞 · 原生声音与语音合成引擎 (FlClash 音频架构 + Web Audio API)

export const SOUND_PROFILES = [
  { id: 'classic', name: '经典三阶 High C', desc: '灵龙标志性 1046.5Hz 纯净正弦音，清亮穿透' },
  { id: 'radar', name: '科技雷达脉冲', desc: '880Hz-1760Hz 快速扫频音，浓厚战术电竞感' },
  { id: 'crystal', name: '清脆水晶水滴', desc: '1318Hz 高频空灵钟音，轻柔悦耳不刺耳' },
  { id: 'urgent', name: '紧迫战备双音', desc: '784Hz / 988Hz 双音紧迫交替，高优先级提醒' },
  { id: 'chord', name: '柔和大三和弦', desc: 'C5-E5-G5-C6 舒缓和弦渐入，沉浸温和' },
  { id: 'custom', name: '自定义本地音频', desc: '支持导入本机 MP3 / WAV / OGG 音频文件' }
];

export const SPEECH_SCHEMES = [
  {
    id: 'classic',
    name: '经典专业风',
    badge: '官方标准',
    icon: '👔',
    tagline: '严谨利落 · 官方规范',
    desc: '清晰规范的标准播报，先报平台与指名提醒，再播报分区与收益，沉稳干练。',
    template: ({ div, title, income, isForMe, workerName }) =>
      isForMe
        ? `灵龙电竞：老板专属指名订单提醒！${div ? div + '，' : ''}${title}${income ? '，预期收益 ' + income : ''}，请及时接单履约！`
        : `灵龙电竞：大厅出现指定订单，${div ? div + '，' : ''}指名打手 ${workerName}${income ? '，收益 ' + income : ''}。`,
    demoText: '灵龙电竞：老板专属指名订单提醒！端游三角洲，航天基地绝密双人护航，预期收益480元，请及时接单履约！',
    pitch: 1.0,
    rateBonus: 1.0
  },
  {
    id: 'tactical',
    name: '极简战术速报',
    badge: '对局极速',
    icon: '⚡',
    tagline: '短平快 · 直切核心',
    desc: '快节奏紧凑战报，过滤一切冗余助词，分秒必争，适合高专注度激战对局。',
    template: ({ div, title, income, isForMe, workerName }) =>
      isForMe
        ? `指名速报！${div ? div + '，' : ''}${income ? income + '。' : ''}老板专属点将，速抢！`
        : `大厅指名单，${div ? div + '，' : ''}指名 ${workerName}${income ? '，' + income : ''}。`,
    demoText: '指名速报！端游三角洲，480元。老板专属点将，速抢！',
    pitch: 1.05,
    rateBonus: 1.15
  },
  {
    id: 'vip',
    name: '尊荣钦点专属',
    badge: '殿堂定制',
    icon: '👑',
    tagline: '尊贵礼遇 · 钦点出击',
    desc: '尊贵礼貌与认同感，突出老客户常客对您实力的高度认可与专属钦点。',
    template: ({ div, title, income, isForMe, workerName }) =>
      isForMe
        ? `尊贵打手您好！VIP老板对您发起专属钦点指名！${div ? div + ' ' : ''}${title}${income ? '，报酬 ' + income : ''}。您的实力深受雇主信赖，请准备出击！`
        : `大厅收到尊荣VIP指名订单，${div ? div + '，' : ''}指定明星打手 ${workerName}${income ? '，报酬 ' + income : ''}。`,
    demoText: '尊贵打手您好！VIP老板对您发起专属钦点指名！端游三角洲 航天基地绝密护航，报酬480元。您的实力深受雇主信赖，请准备出击！',
    pitch: 0.95,
    rateBonus: 0.98
  },
  {
    id: 'battle',
    name: '激昂电竞战报',
    badge: '一级战备',
    icon: '🔥',
    tagline: '热血高燃 · 战备集结',
    desc: '高燃战备指令，拉满电竞激情与肾上腺素，助您热血专注、速战速决！',
    template: ({ div, title, income, isForMe, workerName }) =>
      isForMe
        ? `一级战备警报！检测到老板指名点将！${div ? div + '，' : ''}赏金 ${income || '丰厚'}！全员就位，立即整备出战！`
        : `战备通报：${div ? div + '，' : ''}雇主点将 ${workerName}，赏金 ${income || '丰厚'}。`,
    demoText: '一级战备警报！检测到老板指名点将！端游三角洲，赏金480元！全员就位，立即整备出战！',
    pitch: 1.1,
    rateBonus: 1.1
  },
  {
    id: 'companion',
    name: '温柔助理陪伴',
    badge: '亲切陪伴',
    icon: '🌸',
    tagline: '贴心陪伴 · 舒缓减压',
    desc: '亲切温和的贴心助理口吻，有效缓解连续对局的紧绷神经，接单舒心愉悦。',
    template: ({ div, title, income, isForMe, workerName }) =>
      isForMe
        ? `打手哥哥，有老板指名您接单啦～本次是${div ? div + '护航' : '新'}任务${income ? '，预计收益 ' + income : ''}呢，快去看看吧！`
        : `大厅有新订单指定了打手 ${workerName}，是${div ? div : '专属'}任务${income ? '，可赚 ' + income : ''}哦。`,
    demoText: '打手哥哥，有老板指名您接单啦～本次是端游三角洲护航任务，预计收益480元呢，快去看看吧！',
    pitch: 1.18,
    rateBonus: 0.95
  }
];

export class SoundEngine {
  constructor() {
    this.audioCtx = null;
    this.enabled = localStorage.getItem('ll_sound_enabled') !== 'false'; // 默认开启
    this.volume = parseFloat(localStorage.getItem('ll_sound_volume') || '0.7');
    this.soundProfile = localStorage.getItem('ll_sound_profile') || 'classic';
    this.customSoundData = localStorage.getItem('ll_custom_sound_data') || '';
    this.customSoundName = localStorage.getItem('ll_custom_sound_name') || '';

    // TTS 语音配置
    this.speechDesignated = localStorage.getItem('ll_speech_designated') !== 'false'; // 专属指名单语音播报默认开启
    this.speechGeneral = localStorage.getItem('ll_speech_general') === 'true'; // 普通大厅订单默认关闭语音（只响铃）
    this.speechRate = parseFloat(localStorage.getItem('ll_speech_rate') || '1.05');
    this.speechScheme = localStorage.getItem('ll_speech_scheme') || 'classic'; // 播报文案风格方案
    this.speechIncludeAmount = localStorage.getItem('ll_speech_include_amount') !== 'false'; // 是否朗读具体金额
    this.speechIncludeDivision = localStorage.getItem('ll_speech_include_division') !== 'false'; // 是否朗读游戏分区
    this.speechPitch = parseFloat(localStorage.getItem('ll_speech_pitch') || '1.0'); // 基础音调
    this.speechVoiceURI = localStorage.getItem('ll_speech_voice_uri') || ''; // 指定发音人 URI

    this.lastPingAt = 0;
    this.customAudioEl = null;
    this.ttsCache = new Map();
    this.currentTtsSource = null;
  }

  initContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, parseFloat(val) || 0.7));
    localStorage.setItem('ll_sound_volume', String(this.volume));
    if (this.customAudioEl) {
      this.customAudioEl.volume = this.volume;
    }
  }

  toggleSound(enable) {
    this.enabled = typeof enable === 'boolean' ? enable : !this.enabled;
    localStorage.setItem('ll_sound_enabled', String(this.enabled));
    if (this.enabled) this.initContext();
    return this.enabled;
  }

  setSoundProfile(profileId) {
    const valid = SOUND_PROFILES.some((p) => p.id === profileId);
    this.soundProfile = valid ? profileId : 'classic';
    localStorage.setItem('ll_sound_profile', this.soundProfile);
    return this.soundProfile;
  }

  setCustomSound(dataUrl, fileName) {
    this.customSoundData = dataUrl;
    this.customSoundName = fileName || '自定义音频';
    localStorage.setItem('ll_custom_sound_data', this.customSoundData);
    localStorage.setItem('ll_custom_sound_name', this.customSoundName);
    this.soundProfile = 'custom';
    localStorage.setItem('ll_sound_profile', 'custom');
  }

  clearCustomSound() {
    this.customSoundData = '';
    this.customSoundName = '';
    localStorage.removeItem('ll_custom_sound_data');
    localStorage.removeItem('ll_custom_sound_name');
    if (this.soundProfile === 'custom') {
      this.setSoundProfile('classic');
    }
  }

  toggleSpeechDesignated(enable) {
    this.speechDesignated = typeof enable === 'boolean' ? enable : !this.speechDesignated;
    localStorage.setItem('ll_speech_designated', String(this.speechDesignated));
    return this.speechDesignated;
  }

  toggleSpeechGeneral(enable) {
    this.speechGeneral = typeof enable === 'boolean' ? enable : !this.speechGeneral;
    localStorage.setItem('ll_speech_general', String(this.speechGeneral));
    return this.speechGeneral;
  }

  setSpeechRate(rate) {
    this.speechRate = Math.max(0.5, Math.min(3.0, parseFloat(rate) || 1.0));
    localStorage.setItem('ll_speech_rate', String(this.speechRate));
    return this.speechRate;
  }

  // 播放来单提示音（根据当前选择方案）
  playOrderPings(forceProfile = null) {
    if (!this.enabled) return;
    const now = Date.now();
    // 非试听模式下 1.5 秒节流
    if (!forceProfile && now - this.lastPingAt < 1500) return;
    if (!forceProfile) this.lastPingAt = now;

    const profile = forceProfile || this.soundProfile;

    // 自定义本地音频播放
    if (profile === 'custom' && this.customSoundData) {
      this._playCustomSound();
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([120, 80, 120]);
      } catch (e) {}
    }

    this.initContext();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const curTime = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(this.volume, curTime);
    masterGain.connect(ctx.destination);

    switch (profile) {
      case 'radar':
        this._playRadarPing(ctx, masterGain, curTime);
        break;
      case 'crystal':
        this._playCrystalPing(ctx, masterGain, curTime);
        break;
      case 'urgent':
        this._playUrgentPing(ctx, masterGain, curTime);
        break;
      case 'chord':
        this._playChordPing(ctx, masterGain, curTime);
        break;
      case 'classic':
      default:
        this._playClassicPing(ctx, masterGain, curTime);
        break;
    }
  }

  // 1. 经典三阶 High C (1046.5Hz)
  _playClassicPing(ctx, masterGain, curTime) {
    for (let i = 0; i < 3; i++) {
      const start = curTime + i * 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.28, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(start);
      osc.stop(start + 0.2);
    }
  }

  // 2. 科技雷达脉冲扫频
  _playRadarPing(ctx, masterGain, curTime) {
    for (let i = 0; i < 2; i++) {
      const start = curTime + i * 0.28;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, start);
      osc.frequency.exponentialRampToValueAtTime(1760, start + 0.14);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(start);
      osc.stop(start + 0.24);
    }
  }

  // 3. 清脆水晶水滴
  _playCrystalPing(ctx, masterGain, curTime) {
    const freqs = [1318.5, 1567.98]; // E6, G6
    freqs.forEach((freq, idx) => {
      const start = curTime + idx * 0.15;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.3, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(start);
      osc.stop(start + 0.38);
    });
  }

  // 4. 紧迫战备双音 (784Hz / 988Hz 交替)
  _playUrgentPing(ctx, masterGain, curTime) {
    const pattern = [783.99, 987.77, 783.99, 987.77]; // G5, B5
    pattern.forEach((freq, idx) => {
      const start = curTime + idx * 0.11;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.09);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(start);
      osc.stop(start + 0.1);
    });
  }

  // 5. 柔和大三和弦
  _playChordPing(ctx, masterGain, curTime) {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const start = curTime + idx * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(start);
      osc.stop(start + 0.42);
    });
  }

  // 自定义本地音频播放
  _playCustomSound() {
    try {
      if (!this.customAudioEl) {
        this.customAudioEl = new Audio();
      }
      this.customAudioEl.src = this.customSoundData;
      this.customAudioEl.volume = this.volume;
      this.customAudioEl.currentTime = 0;
      this.customAudioEl.play().catch((e) => {
        console.warn('Custom sound play error:', e);
        // 回退至经典音效
        this.initContext();
        if (this.audioCtx) {
          const masterGain = this.audioCtx.createGain();
          masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
          masterGain.connect(this.audioCtx.destination);
          this._playClassicPing(this.audioCtx, masterGain, this.audioCtx.currentTime);
        }
      });
    } catch (e) {
      console.warn('Audio tag play failed:', e);
    }
  }

  // 成功/接单/到账音效 (升调大三和弦)
  playSuccessChime() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const curTime = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(this.volume, curTime);
    masterGain.connect(ctx.destination);

    const notes = [523.25, 659.25, 783.99, 1046.5];

    notes.forEach((freq, idx) => {
      const start = curTime + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(start);
      osc.stop(start + 0.26);
    });
  }

  // 警告/退单音效 (双音降调)
  playWarnChime() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const curTime = ctx.currentTime;
    const notes = [440, 349.23];

    notes.forEach((freq, idx) => {
      const start = curTime + idx * 0.12;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.12 * this.volume, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.22);
    });
  }

  // 设置播报风格方案
  setSpeechScheme(schemeId) {
    this.speechScheme = schemeId;
    localStorage.setItem('ll_speech_scheme', schemeId);
  }

  // 切换是否播报具体金额
  toggleSpeechIncludeAmount() {
    this.speechIncludeAmount = !this.speechIncludeAmount;
    localStorage.setItem('ll_speech_include_amount', String(this.speechIncludeAmount));
    return this.speechIncludeAmount;
  }

  // 切换是否播报分区
  toggleSpeechIncludeDivision() {
    this.speechIncludeDivision = !this.speechIncludeDivision;
    localStorage.setItem('ll_speech_include_division', String(this.speechIncludeDivision));
    return this.speechIncludeDivision;
  }

  // 设置音调
  setSpeechPitch(pitch) {
    this.speechPitch = Math.max(0.7, Math.min(1.4, parseFloat(pitch) || 1.0));
    localStorage.setItem('ll_speech_pitch', String(this.speechPitch));
  }

  // 设置指定系统发音人
  setSpeechVoice(voiceURI) {
    this.speechVoiceURI = voiceURI;
    localStorage.setItem('ll_speech_voice_uri', voiceURI);
  }

  // 获取系统已安装的中文普通话语音发音人
  getChineseVoices() {
    if (!('speechSynthesis' in window)) return [];
    const all = window.speechSynthesis.getVoices() || [];
    return all.filter((v) => {
      const l = (v.lang || '').toLowerCase();
      const n = (v.name || '').toLowerCase();
      return l.startsWith('zh') || l.includes('cmn') || n.includes('chinese') || n.includes('xiaoxiao') || n.includes('yunxi') || n.includes('huihui') || n.includes('yaoyao');
    });
  }

  // 灵龙云端高保真神经网络 TTS (AudioContext Web Audio 解码播放)
  async _playCloudTTS(text, rate = 1.0) {
    this.initContext();
    if (!this.audioCtx) throw new Error('AudioContext unavailable');

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume().catch(() => {});
    }

    let audioBuffer = this.ttsCache.get(text);
    if (!audioBuffer) {
      const url = `https://www.linglong.club/api/tts?text=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Cloud TTS returned ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
      if (this.ttsCache.size > 40) {
        const firstKey = this.ttsCache.keys().next().value;
        this.ttsCache.delete(firstKey);
      }
      this.ttsCache.set(text, audioBuffer);
    }

    if (this.currentTtsSource) {
      try {
        this.currentTtsSource.stop();
      } catch (_) {}
      this.currentTtsSource = null;
    }

    const source = this.audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = Math.max(0.5, Math.min(3.0, rate || 1.0));

    const gainNode = this.audioCtx.createGain();
    gainNode.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);

    source.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);

    this.currentTtsSource = source;
    source.onended = () => {
      if (this.currentTtsSource === source) {
        this.currentTtsSource = null;
      }
    };

    source.start(0);
    return true;
  }

  // 基础语音播报 (TTS: 云端神经网络优先，本地 Web Speech 兜底)
  async speak(text, customRate = null, customPitch = null) {
    if (!this.enabled || !text) return;

    // 1. 优先采用灵龙云端高保真神经网络语音 (解决 Windows Electron 无法调用系统 Web Speech 问题)
    try {
      const rate = customRate || this.speechRate;
      const success = await this._playCloudTTS(text, rate);
      if (success) return;
    } catch (cloudErr) {
      console.warn('Cloud TTS failed, attempting local fallback:', cloudErr);
    }

    // 2. 本地系统 Web Speech API 兜底
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = customRate || this.speechRate;
        utterance.pitch = customPitch || this.speechPitch;
        utterance.volume = this.volume;

        const voices = this.getChineseVoices();
        if (this.speechVoiceURI) {
          const found = voices.find((v) => v.voiceURI === this.speechVoiceURI);
          if (found) utterance.voice = found;
        } else if (voices.length > 0) {
          const preferred = voices.find((v) => /xiaoxiao|yunxi|huihui|natural/i.test(v.name)) || voices[0];
          if (preferred) utterance.voice = preferred;
        }

        window.speechSynthesis.speak(utterance);
        return;
      } catch (e) {
        console.warn('Local Web Speech API fallback failed:', e);
      }
    }

    // 3. 终极兜底：当离线且无语音库时，播放柔和水晶和弦提示音避免静音
    this.playOrderPings('crystal');
  }

  // 专属指定单智能 TTS 播报
  speakDesignatedOrder(order, currentUser) {
    if (!this.enabled || !this.speechDesignated || !order) return;

    const divisionMap = {
      'pc-delta': '端游三角洲',
      'mobile-delta': '手游三角洲',
      'honor-of-kings': '王者荣耀',
      apex: 'APEX英雄'
    };
    const divName = this.speechIncludeDivision ? (divisionMap[order.game_division] || order.game_division || '游戏') : '';

    // 计算收益
    let incomeText = '';
    if (this.speechIncludeAmount) {
      let amountYuan = 0;
      if (Array.isArray(order.slot_incomes) && order.slot_incomes.length > 0) {
        amountYuan = Math.round(order.slot_incomes[0] / 100);
      } else if (order.expected_income) {
        amountYuan = Math.round(order.expected_income / 100);
      } else if (order.list_amount) {
        amountYuan = Math.round(order.list_amount);
      }
      if (amountYuan > 0) {
        incomeText = `${amountYuan}元`;
      }
    }

    // 判断是否指名到本人
    const myId = currentUser?.id;
    const myName = currentUser?.nickname;
    const isForMe = Array.isArray(order.named_workers) && order.named_workers.some(
      (w) => (myId && w.id === myId) || (myName && w.nickname === myName)
    );
    const workerName = (order.named_workers || []).map((w) => w.nickname).join('、') || '指定打手';

    const scheme = SPEECH_SCHEMES.find((s) => s.id === this.speechScheme) || SPEECH_SCHEMES[0];
    const speechText = scheme.template({
      div: divName,
      title: order.title || '专属护航单',
      income: incomeText,
      isForMe,
      workerName
    });

    const finalRate = (this.speechRate * (scheme.rateBonus || 1.0)).toFixed(2);
    const finalPitch = (this.speechPitch * (scheme.pitch || 1.0)).toFixed(2);

    this.speak(speechText, parseFloat(finalRate), parseFloat(finalPitch));
  }

  // 试听专属指名订单语音播报
  testDesignatedSpeech(schemeId = null) {
    const targetId = schemeId || this.speechScheme;
    const scheme = SPEECH_SCHEMES.find((s) => s.id === targetId) || SPEECH_SCHEMES[0];
    const finalRate = (this.speechRate * (scheme.rateBonus || 1.0)).toFixed(2);
    const finalPitch = (this.speechPitch * (scheme.pitch || 1.0)).toFixed(2);
    this.speak(scheme.demoText, parseFloat(finalRate), parseFloat(finalPitch));
  }
}
