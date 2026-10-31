import 'package:flutter/material.dart';
import '../theme/colors.dart';
import '../theme/text_styles.dart';
import '../theme/surfaces.dart';
import '../models/user.dart';
import '../models/notice.dart';
import '../services/api_service.dart';

class NoticeView extends StatefulWidget {
  final User? currentUser;
  final Notice? notice;
  final VoidCallback onNoticeSigned;

  const NoticeView({
    super.key,
    required this.currentUser,
    required this.notice,
    required this.onNoticeSigned,
  });

  @override
  State<NoticeView> createState() => _NoticeViewState();
}

class _NoticeViewState extends State<NoticeView> {
  final ApiService _api = ApiService();
  final ScrollController _scrollController = ScrollController();
  final TextEditingController _ackController = TextEditingController();
  final TextEditingController _adultController = TextEditingController();

  bool _reachedBottom = false;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    _ackController.dispose();
    _adultController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 20) {
      if (!_reachedBottom) {
        setState(() => _reachedBottom = true);
        if (widget.notice?.readToken != null) {
          _api.markWorkerNoticeRead(widget.notice!.readToken!);
        }
      }
    }
  }

  Future<void> _submitAcceptance() async {
    final notice = widget.notice;
    if (notice == null || notice.readToken == null) return;

    final ack = _ackController.text.trim();
    final adult = _adultController.text.trim();

    if (ack != notice.acknowledgement) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('请输入完整确认语：“${notice.acknowledgement}”')),
      );
      return;
    }

    if (adult != '我已年满18周岁，具备完全民事行为能力，确认继续接单') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请输入完整成年确认语：“我已年满18周岁，具备完全民事行为能力，确认继续接单”')),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      await _api.acceptWorkerNotice(notice.readToken!, ack, adult);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('🎉 打手须知签署成功！已激活完整抢单权限')),
        );
        widget.onNoticeSigned();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final notice = widget.notice;
    final isAccepted = notice != null && notice.accepted;

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('📖 打手服务公约手册', style: AppTextStyles.heading1),
                const SizedBox(height: 4),
                Text('版本 ${notice?.version ?? 'V4.0'} · 官方服务履约与安全防线', style: AppTextStyles.caption),
              ],
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: isAccepted
                    ? AppColors.success.withOpacity(0.18)
                    : AppColors.accent.withOpacity(0.2),
                borderRadius: BorderRadius.circular(FlRadius.full),
              ),
              child: Text(
                isAccepted ? '✔ 已签署生效' : '⚠️ 待确认签署',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: isAccepted ? AppColors.success : AppColors.accent,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),

        // 须知正文可滚动卡片
        SurfaceContainer(
          level: SurfaceLevel.card,
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                height: 280,
                child: Scrollbar(
                  controller: _scrollController,
                  thumbVisibility: true,
                  child: SingleChildScrollView(
                    controller: _scrollController,
                    child: Text(
                      notice?.text.isNotEmpty == true
                          ? notice!.text
                          : '正在拉取灵龙电竞打手服务公约与安全须知全文...',
                      style: AppTextStyles.body.copyWith(
                        fontSize: 12,
                        height: 1.6,
                        color: AppColors.textMain,
                      ),
                    ),
                  ),
                ),
              ),
              const Divider(color: AppColors.borderHairline, height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    isAccepted
                        ? '✔ 您已完成签署，协议具备平台管理合规效力'
                        : _reachedBottom
                            ? '✅ 已阅读至末尾，可在下方完成签署'
                            : '⏳ 请向下滚动阅读至全文末尾以激活签署',
                    style: TextStyle(
                      fontSize: 11,
                      color: isAccepted || _reachedBottom
                          ? AppColors.success
                          : AppColors.accent,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // 底部签署或凭据卡片
        if (isAccepted)
          SurfaceContainer(
            level: SurfaceLevel.card,
            padding: const EdgeInsets.all(16),
            borderColor: AppColors.success,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: const [
                    Text('🛡️', style: TextStyle(fontSize: 20)),
                    SizedBox(width: 8),
                    Text('电子公约协议签署凭据已归档',
                        style: TextStyle(
                            color: AppColors.success,
                            fontWeight: FontWeight.w700,
                            fontSize: 13)),
                  ],
                ),
                const SizedBox(height: 10),
                Text('签署打手：${widget.currentUser?.nickname ?? '打手'} (${widget.currentUser?.username ?? ''})',
                    style: AppTextStyles.bodyMuted),
                const SizedBox(height: 4),
                Text('生效版本：${notice?.version ?? 'V4.0'}', style: AppTextStyles.bodyMuted),
                const SizedBox(height: 4),
                Text('防篡改指纹：${notice?.textHash.substring(0, 16) ?? 'SHA-256'}...',
                    style: AppTextStyles.mono.copyWith(color: AppColors.textDim)),
              ],
            ),
          )
        else
          SurfaceContainer(
            level: SurfaceLevel.card,
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('✍️ 在线确认签署新版须知', style: AppTextStyles.heading2),
                const SizedBox(height: 8),
                Text(
                  '请在下方手动输入确认文字并提交：',
                  style: AppTextStyles.caption.copyWith(color: AppColors.textMuted),
                ),
                const SizedBox(height: 12),

                // 确认语 1
                TextField(
                  controller: _ackController,
                  enabled: _reachedBottom,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    labelText: '请确认输入：${notice?.acknowledgement ?? '我已阅读新版须知内容'}',
                    labelStyle: const TextStyle(color: AppColors.textDim, fontSize: 11),
                    filled: true,
                    fillColor: AppColors.surfaceBlock,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(FlRadius.sm),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
                const SizedBox(height: 10),

                // 成年确认语 2
                TextField(
                  controller: _adultController,
                  enabled: _reachedBottom,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    labelText: '成年确认：我已年满18周岁，具备完全民事行为能力，确认继续接单',
                    labelStyle: const TextStyle(color: AppColors.textDim, fontSize: 11),
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
                    onPressed: _reachedBottom && !_submitting ? _submitAcceptance : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(FlRadius.sm),
                      ),
                    ),
                    child: Text(
                      _submitting ? '正在提交签署...' : '✍️ 确认已读并签署协议',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
