import 'package:flutter/services.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';
import '../models/order.dart';

class SoundService {
  static final SoundService _instance = SoundService._internal();
  factory SoundService() => _instance;
  SoundService._internal();

  final AudioPlayer _audioPlayer = AudioPlayer();

  bool soundEnabled = true;
  bool speechDesignated = true;
  bool speechGeneral = false;
  bool speechIncludeAmount = true;
  bool speechIncludeDivision = true;

  double volume = 0.9;
  double speechRate = 1.0; // 0.5x to 3.0x
  String soundProfile = 'classic';
  String speechScheme = 'classic';

  final Map<String, String> schemeNames = {
    'classic': '经典专业风 (官方标准 · 严谨利落)',
    'tactical': '极简战术速报 (对局极速 · 短平快)',
    'vip': '尊荣钦点专属 (殿堂定制 · 礼遇认同)',
    'battle': '激昂电竞战报 (一级战备 · 高燃热血)',
    'companion': '温柔助理陪伴 (亲切陪伴 · 舒缓贴心)',
  };

  final Map<String, String> profileNames = {
    'classic': '灵龙经典三音律 (1046.5Hz 高C清脆三连音)',
    'radar': '科技雷达扫描音 (幽蓝频偏声呐递进音)',
    'crystal': '水晶剔透提示音 (泛音共振轻盈晶莹)',
    'urgent': '战备紧急警报 (高能跳频急促强提醒)',
    'chord': '大厅清脆和弦音 (四音阶上扬欢快和弦)',
  };

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    soundEnabled = prefs.getBool('ll_sound_enabled') ?? true;
    speechDesignated = prefs.getBool('ll_speech_designated') ?? true;
    speechGeneral = prefs.getBool('ll_speech_general') ?? false;
    speechIncludeAmount = prefs.getBool('ll_speech_include_amount') ?? true;
    speechIncludeDivision = prefs.getBool('ll_speech_include_division') ?? true;
    volume = prefs.getDouble('ll_sound_volume') ?? 0.9;
    speechRate = prefs.getDouble('ll_speech_rate') ?? 1.0;
    soundProfile = prefs.getString('ll_sound_profile') ?? 'classic';
    speechScheme = prefs.getString('ll_speech_scheme') ?? 'classic';

    await _audioPlayer.setVolume(volume);
  }

  Future<void> saveSettings() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('ll_sound_enabled', soundEnabled);
    await prefs.setBool('ll_speech_designated', speechDesignated);
    await prefs.setBool('ll_speech_general', speechGeneral);
    await prefs.setBool('ll_speech_include_amount', speechIncludeAmount);
    await prefs.setBool('ll_speech_include_division', speechIncludeDivision);
    await prefs.setDouble('ll_sound_volume', volume);
    await prefs.setDouble('ll_speech_rate', speechRate);
    await prefs.setString('ll_sound_profile', soundProfile);
    await prefs.setString('ll_speech_scheme', speechScheme);
    await _audioPlayer.setVolume(volume);
  }

  /// 播放来单提示音
  Future<void> playOrderChime([String? profile]) async {
    if (!soundEnabled) return;
    HapticFeedback.mediumImpact();

    // 云端预设提示音或合成音
    final p = profile ?? soundProfile;
    final text = '来单了';
    final url = '${ApiService().baseUrl}/api/tts?text=${Uri.encodeComponent(text)}';
    try {
      await _audioPlayer.stop();
      await _audioPlayer.setPlaybackRate(speechRate);
      await _audioPlayer.play(UrlSource(url));
    } catch (_) {}
  }

  /// 朗读文本 (优先高保真云端 TTS)
  Future<void> speak(String text) async {
    if (!soundEnabled) return;
    HapticFeedback.lightImpact();

    final url = '${ApiService().baseUrl}/api/tts?text=${Uri.encodeComponent(text)}';
    try {
      await _audioPlayer.stop();
      await _audioPlayer.setPlaybackRate(speechRate);
      await _audioPlayer.play(UrlSource(url));
    } catch (_) {}
  }

  /// 生成指名播报文本
  String generateDesignatedText({
    required String division,
    required String title,
    required String earning,
    String? scheme,
  }) {
    final sc = scheme ?? speechScheme;
    final divPart = speechIncludeDivision ? division : '';
    final amountPart = speechIncludeAmount ? '，收益预计 $earning 元' : '';

    switch (sc) {
      case 'tactical':
        return '战备呼叫！指定订单到位：$divPart $title$amountPart，迅速锁定！';
      case 'vip':
        return '老板钦点！专属客户指定您上场：$divPart $title$amountPart，尊荣专属，请速接单。';
      case 'battle':
        return '一级战备！老板指名王牌出击：$divPart $title$amountPart，全装就绪，立即接单！';
      case 'companion':
        return '打手老师，有老板专门指定您呢：$divPart $title$amountPart，辛苦啦，快去接单吧。';
      case 'classic':
      default:
        return '尊敬的打手，您收到一笔专属指名订单：$divPart $title$amountPart，请及时进入大厅接单。';
    }
  }

  /// 试听指名语音
  Future<void> testDesignatedSpeech([String? scheme]) async {
    final text = generateDesignatedText(
      division: '三角洲航天基地',
      title: '绝密全面护航保底撤离',
      earning: '88.00',
      scheme: scheme,
    );
    await speak(text);
  }

  /// 对指定订单触发指名播报
  Future<void> notifyDesignatedOrder(Order order) async {
    if (!speechDesignated) return;
    HapticFeedback.heavyImpact();
    final text = generateDesignatedText(
      division: order.gameDivision == 'pc-delta' ? 'PC三角洲' : '手游三角洲',
      title: order.title,
      earning: order.displayEarning,
    );
    await speak(text);
  }
}
