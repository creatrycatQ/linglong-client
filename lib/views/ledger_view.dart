import 'package:flutter/material.dart';
import '../theme/colors.dart';
import '../theme/text_styles.dart';
import '../theme/surfaces.dart';
import '../models/user.dart';
import '../services/api_service.dart';

class LedgerView extends StatefulWidget {
  final User? currentUser;
  const LedgerView({super.key, required this.currentUser});

  @override
  State<LedgerView> createState() => _LedgerViewState();
}

class _LedgerViewState extends State<LedgerView> {
  final ApiService _api = ApiService();
  Map<String, dynamic>? _dashboard;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _loadLedger();
  }

  Future<void> _loadLedger() async {
    if (widget.currentUser == null) return;
    setState(() => _loading = true);
    try {
      final res = await _api.getDashboard();
      setState(() => _dashboard = res);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  void _showWithdrawDialog() {
    final amountController = TextEditingController();
    final accountController = TextEditingController();
    String method = 'alipay';

    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surfaceCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(FlRadius.lg)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('💰 申请收益提现', style: AppTextStyles.heading2),
                  const SizedBox(height: 14),
                  TextField(
                    controller: amountController,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      labelText: '提现金额 (元)',
                      labelStyle: const TextStyle(color: AppColors.textMuted),
                      prefixText: '¥ ',
                      prefixStyle: const TextStyle(color: AppColors.primary),
                      filled: true,
                      fillColor: AppColors.surfaceBlock,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(FlRadius.sm),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: accountController,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      labelText: '支付宝/微信收款账号',
                      labelStyle: const TextStyle(color: AppColors.textMuted),
                      filled: true,
                      fillColor: AppColors.surfaceBlock,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(FlRadius.sm),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () async {
                        final val = double.tryParse(amountController.text.trim());
                        if (val == null || val <= 0) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('请输入有效金额')),
                          );
                          return;
                        }
                        final cents = (val * 100).toInt();
                        try {
                          await _api.createWithdrawal(cents, method, accountController.text.trim());
                          Navigator.pop(ctx);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('提现申请已提交，财务将在2小时内审核打款')),
                          );
                          _loadLedger();
                        } catch (e) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
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
                      child: const Text('立即提交提现', style: TextStyle(fontWeight: FontWeight.w700)),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (widget.currentUser == null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Text('💳', style: TextStyle(fontSize: 40)),
            SizedBox(height: 12),
            Text('请先登录打手账号', style: AppTextStyles.heading2),
            SizedBox(height: 4),
            Text('登录后即可查阅收益余额与提现流水', style: AppTextStyles.bodyMuted),
          ],
        ),
      );
    }

    final balanceYuan = (widget.currentUser!.balance / 100.0).toStringAsFixed(2);
    final earnings = _dashboard?['earnings'];
    final totalSettled = earnings?['total_settled'] is num
        ? ((earnings['total_settled'] as num) / 100.0).toStringAsFixed(2)
        : balanceYuan;

    return RefreshIndicator(
      color: AppColors.primary,
      backgroundColor: AppColors.surfaceCard,
      onRefresh: _loadLedger,
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Text('💳 财务与收益看板', style: AppTextStyles.heading1),
                  SizedBox(height: 4),
                  Text('打手收益结转、钱包余额与提现记录', style: AppTextStyles.caption),
                ],
              ),
              ElevatedButton.icon(
                onPressed: _showWithdrawDialog,
                icon: const Icon(Icons.account_balance_wallet, size: 16),
                label: const Text('提现'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.black,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(FlRadius.sm),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // 核心财务卡片网格 (2x2)
          Row(
            children: [
              Expanded(
                child: _buildMetricCard(
                  title: '可提现余额',
                  value: '¥$balanceYuan',
                  color: AppColors.primary,
                  icon: Icons.savings,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildMetricCard(
                  title: '累计总结算',
                  value: '¥$totalSettled',
                  color: AppColors.success,
                  icon: Icons.trending_up,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _buildMetricCard(
                  title: '信用担保积分',
                  value: '${widget.currentUser!.creditScore} 分',
                  color: AppColors.accent,
                  icon: Icons.verified_user,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildMetricCard(
                  title: '提现手续费',
                  value: '0% 免手续费',
                  color: AppColors.textMuted,
                  icon: Icons.percent,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // 财务须知提示
          SurfaceContainer(
            level: SurfaceLevel.card,
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text('📌 灵龙打手结转提现须知', style: AppTextStyles.heading3),
                SizedBox(height: 6),
                Text(
                  '1. 订单完成且老板或客服审核确认后，收益将实时计入您的打手钱包。\n'
                  '2. 提现申请提交后，财务客服将于每日 10:00 - 24:00 集中审核打款。\n'
                  '3. 支持支付宝与微信零钱直转，平台不收取任何通道手续费。',
                  style: AppTextStyles.bodyMuted,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    required Color color,
    required IconData icon,
  }) {
    return SurfaceContainer(
      level: SurfaceLevel.card,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 6),
              Text(title, style: AppTextStyles.caption),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            value,
            style: AppTextStyles.heading1.copyWith(color: color, fontFamily: 'monospace'),
          ),
        ],
      ),
    );
  }
}
