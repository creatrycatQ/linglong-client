import 'package:flutter/material.dart';
import '../theme/colors.dart';
import '../theme/text_styles.dart';
import '../theme/surfaces.dart';
import '../services/api_service.dart';
import '../services/sound_service.dart';

class SettingsView extends StatefulWidget {
  const SettingsView({super.key});

  @override
  State<SettingsView> createState() => _SettingsViewState();
}

class _SettingsViewState extends State<SettingsView> {
  final SoundService _sound = SoundService();
  final ApiService _api = ApiService();

  int _currentTab = 1; // 0: 音效, 1: 语音播报, 2: 版本更新, 3: 网络连接
  final TextEditingController _hostController = TextEditingController();
  bool _checkingUpdate = false;

  @override
  void initState() {
    super.initState();
    _hostController.text = _api.baseUrl;
  }

  @override
  void dispose() {
    _hostController.dispose();
    super.dispose();
  }

  Future<void> _checkUpdateManual() async {
    setState(() => _checkingUpdate = true);
    try {
      final res = await _api.checkUpdate();
      if (mounted) {
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            backgroundColor: AppColors.surfaceCard,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(FlRadius.md),
            ),
            title: Text(res['title'] ?? '发现新版本', style: AppTextStyles.heading2),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('最新版本：v${res['client_version'] ?? '1.0.2'}',
                    style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700)),
                const SizedBox(height: 10),
                const Text('更新日志：', style: AppTextStyles.caption),
                if (res['changelog'] is List)
                  ...((res['changelog'] as List)
                      .map((c) => Text('• $c', style: AppTextStyles.bodyMuted))),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('我知道了'),
              ),
            ],
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('当前已是最新版本 v1.0.2')),
        );
      }
    } finally {
      if (mounted) setState(() => _checkingUpdate = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      children: [
        const Text('⚙️ 客户端设置', style: AppTextStyles.heading1),
        const SizedBox(height: 4),
        const Text('来单音效库、TTS 智能语音播报、版本更新与服务连接', style: AppTextStyles.caption),
        const SizedBox(height: 14),

        // FlClash Segmented Sub-nav
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: AppColors.surfaceBlock,
            borderRadius: BorderRadius.circular(FlRadius.sm),
          ),
          child: Row(
            children: [
              _buildSubnavTab(0, '🔔 来单音效'),
              _buildSubnavTab(1, '🗣️ 语音播报'),
              _buildSubnavTab(2, '🚀 版本更新'),
              _buildSubnavTab(3, '🌐 网络连接'),
            ],
          ),
        ),
        const SizedBox(height: 16),

        if (_currentTab == 0) _buildSoundTab(),
        if (_currentTab == 1) _buildSpeechTab(),
        if (_currentTab == 2) _buildUpdateTab(),
        if (_currentTab == 3) _buildNetworkTab(),
      ],
    );
  }

  Widget _buildSubnavTab(int index, String label) {
    final active = _currentTab == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _currentTab = index),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: active ? AppColors.primary.withOpacity(0.2) : Colors.transparent,
            borderRadius: BorderRadius.circular(FlRadius.xs),
            border: active ? Border.all(color: AppColors.primary, width: 0.67) : null,
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: active ? FontWeight.w700 : FontWeight.w400,
              color: active ? AppColors.primary : AppColors.textMuted,
            ),
          ),
        ),
      ),
    );
  }

  // === 1. 来单音效 Tab ===
  Widget _buildSoundTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SurfaceContainer(
          level: SurfaceLevel.card,
          padding: const EdgeInsets.all(16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Text('开启大厅来单提示音', style: AppTextStyles.heading3),
                  SizedBox(height: 2),
                  Text('有新单发布时播放高频提示音', style: AppTextStyles.caption),
                ],
              ),
              Switch(
                value: _sound.soundEnabled,
                activeColor: AppColors.primary,
                onChanged: (val) {
                  setState(() => _sound.soundEnabled = val);
                  _sound.saveSettings();
                },
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        const Text('🎵 来单音效方案库', style: AppTextStyles.heading3),
        const SizedBox(height: 10),
        ..._sound.profileNames.entries.map((e) {
          final isSelected = _sound.soundProfile == e.key;
          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            child: SurfaceContainer(
              level: SurfaceLevel.card,
              borderColor: isSelected ? AppColors.primary : AppColors.borderHairline,
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Radio<String>(
                    value: e.key,
                    groupValue: _sound.soundProfile,
                    activeColor: AppColors.primary,
                    onChanged: (val) {
                      if (val != null) {
                        setState(() => _sound.soundProfile = val);
                        _sound.saveSettings();
                        _sound.playOrderChime(val);
                      }
                    },
                  ),
                  Expanded(
                    child: Text(e.value, style: AppTextStyles.body),
                  ),
                  IconButton(
                    icon: const Icon(Icons.headphones, size: 18, color: AppColors.primary),
                    onPressed: () => _sound.playOrderChime(e.key),
                    tooltip: '试听',
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }

  // === 2. 语音播报 Tab ===
  Widget _buildSpeechTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SurfaceContainer(
          level: SurfaceLevel.card,
          padding: const EdgeInsets.all(16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Text('专属指名订单 TTS 智能播报', style: AppTextStyles.heading3),
                  SizedBox(height: 2),
                  Text('老板指名您时，智能朗读具体订单分区与收益', style: AppTextStyles.caption),
                ],
              ),
              Switch(
                value: _sound.speechDesignated,
                activeColor: AppColors.primary,
                onChanged: (val) {
                  setState(() => _sound.speechDesignated = val);
                  _sound.saveSettings();
                },
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // 语速调节滑块 (0.5x 至 3.0x)
        SurfaceContainer(
          level: SurfaceLevel.card,
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('⚡ 语音播报语速', style: AppTextStyles.heading3),
                  Text(
                    '${_sound.speechRate.toStringAsFixed(2)}x',
                    style: AppTextStyles.currency,
                  ),
                ],
              ),
              Slider(
                value: _sound.speechRate,
                min: 0.5,
                max: 3.0,
                divisions: 25,
                activeColor: AppColors.primary,
                onChanged: (val) {
                  setState(() => _sound.speechRate = val);
                },
                onChangeEnd: (val) {
                  _sound.saveSettings();
                  _sound.testDesignatedSpeech();
                },
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [0.5, 1.0, 1.5, 2.0, 3.0].map((rate) {
                  return GestureDetector(
                    onTap: () {
                      setState(() => _sound.speechRate = rate);
                      _sound.saveSettings();
                      _sound.testDesignatedSpeech();
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: _sound.speechRate == rate
                            ? AppColors.primary.withOpacity(0.2)
                            : AppColors.surfaceBlock,
                        borderRadius: BorderRadius.circular(FlRadius.xs),
                      ),
                      child: Text(
                        '${rate}x',
                        style: TextStyle(
                          fontSize: 11,
                          color: _sound.speechRate == rate
                              ? AppColors.primary
                              : AppColors.textMuted,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        const Text('🎭 老板指名播报风格文案库', style: AppTextStyles.heading3),
        const SizedBox(height: 10),
        ..._sound.schemeNames.entries.map((e) {
          final isSelected = _sound.speechScheme == e.key;
          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            child: SurfaceContainer(
              level: SurfaceLevel.card,
              borderColor: isSelected ? AppColors.primary : AppColors.borderHairline,
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Radio<String>(
                        value: e.key,
                        groupValue: _sound.speechScheme,
                        activeColor: AppColors.primary,
                        onChanged: (val) {
                          if (val != null) {
                            setState(() => _sound.speechScheme = val);
                            _sound.saveSettings();
                            _sound.testDesignatedSpeech(val);
                          }
                        },
                      ),
                      Expanded(
                        child: Text(e.value, style: AppTextStyles.body),
                      ),
                      IconButton(
                        icon: const Icon(Icons.volume_up, size: 18, color: AppColors.primary),
                        onPressed: () => _sound.testDesignatedSpeech(e.key),
                        tooltip: '试听此方案',
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }

  // === 3. 版本更新 Tab ===
  Widget _buildUpdateTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SurfaceContainer(
          level: SurfaceLevel.card,
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('📦 灵龙电竞接单助手 Android 原生版', style: AppTextStyles.heading2),
              const SizedBox(height: 6),
              const Text('当前客户端版本：v1.0.2 · Flutter 原生自绘引擎', style: AppTextStyles.bodyMuted),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _checkingUpdate ? null : _checkUpdateManual,
                  icon: const Icon(Icons.update, size: 18),
                  label: Text(_checkingUpdate ? '正在检查...' : '立即检查更新'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(FlRadius.sm),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // 官方客服支持卡片
        SurfaceContainer(
          level: SurfaceLevel.card,
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              Text('客户端作者：CreatryCat', style: AppTextStyles.heading3),
              SizedBox(height: 8),
              Text('联系QQ：2097764829', style: TextStyle(color: AppColors.primary, fontSize: 14)),
            ],
          ),
        ),
      ],
    );
  }

  // === 4. 网络连接 Tab ===
  Widget _buildNetworkTab() {
    return SurfaceContainer(
      level: SurfaceLevel.card,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('🌐 灵龙后端服务连接设置', style: AppTextStyles.heading2),
          const SizedBox(height: 12),
          TextField(
            controller: _hostController,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              labelText: '服务器接口地址 (Base URL)',
              labelStyle: const TextStyle(color: AppColors.textMuted),
              filled: true,
              fillColor: AppColors.surfaceBlock,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(FlRadius.sm),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () async {
                final url = _hostController.text.trim();
                await _api.setBaseUrl(url);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('服务器接口地址已更新保存')),
                  );
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(FlRadius.sm),
                ),
              ),
              child: const Text('保存并应用连接', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
    );
  }
}
