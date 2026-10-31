import 'package:flutter/material.dart';
import '../theme/colors.dart';
import '../theme/text_styles.dart';
import '../theme/surfaces.dart';
import '../models/user.dart';
import '../services/api_service.dart';

class ActiveOrdersView extends StatefulWidget {
  final User? currentUser;
  const ActiveOrdersView({super.key, required this.currentUser});

  @override
  State<ActiveOrdersView> createState() => _ActiveOrdersViewState();
}

class _ActiveOrdersViewState extends State<ActiveOrdersView> {
  final ApiService _api = ApiService();
  List<dynamic> _activeOrders = [];
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _loadActiveOrders();
  }

  Future<void> _loadActiveOrders() async {
    if (widget.currentUser == null) return;
    setState(() => _loading = true);
    try {
      final dash = await _api.getDashboard();
      if (dash['workerOrders'] is List) {
        final list = (dash['workerOrders'] as List)
            .where((o) => ['matched', 'service'].contains(o['status']))
            .toList();
        setState(() => _activeOrders = list);
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _completeOrder(String orderId) async {
    try {
      await _api.completeOrder(orderId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('🎉 结单申请已提交审核')),
        );
        _loadActiveOrders();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.currentUser == null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Text('🔑', style: TextStyle(fontSize: 40)),
            SizedBox(height: 12),
            Text('请先登录打手账号', style: AppTextStyles.heading2),
            SizedBox(height: 4),
            Text('登录后即可查看正在执行的护航对局', style: AppTextStyles.bodyMuted),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: AppColors.primary,
      backgroundColor: AppColors.surfaceCard,
      onRefresh: _loadActiveOrders,
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('🎮 履约中工单', style: AppTextStyles.heading1),
                  const SizedBox(height: 4),
                  Text('当前正在履约对局：${_activeOrders.length} 单', style: AppTextStyles.caption),
                ],
              ),
              IconButton(
                icon: const Icon(Icons.refresh, color: AppColors.primary),
                onPressed: _loadActiveOrders,
              ),
            ],
          ),
          const SizedBox(height: 14),

          if (_loading)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(40),
                child: CircularProgressIndicator(color: AppColors.primary),
              ),
            )
          else if (_activeOrders.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(40),
                child: Column(
                  children: const [
                    Text('🛡️', style: TextStyle(fontSize: 40)),
                    SizedBox(height: 12),
                    Text('暂无正在履约中的订单', style: AppTextStyles.heading3),
                    SizedBox(height: 4),
                    Text('前往接单大厅抢单后即可在此查看对局信息与房间凭证', style: AppTextStyles.caption),
                  ],
                ),
              ),
            )
          else
            ..._activeOrders.map((o) => _buildActiveCard(o)),
        ],
      ),
    );
  }

  Widget _buildActiveCard(Map<String, dynamic> o) {
    final orderId = o['id']?.toString() ?? '';
    final title = o['title']?.toString() ?? '电竞服务';
    final income = o['my_income'] is num
        ? ((o['my_income'] as num) / 100.0).toStringAsFixed(2)
        : '0.00';
    final room = o['room_number']?.toString() ?? o['roomDetails']?['roomNumber']?.toString() ?? '待分配';
    final pwd = o['room_password']?.toString() ?? o['roomDetails']?['password']?.toString() ?? '无密码';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: SurfaceContainer(
        level: SurfaceLevel.card,
        borderColor: AppColors.primary,
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text('🔥 履约进行中',
                    style: TextStyle(color: AppColors.accent, fontWeight: FontWeight.w700, fontSize: 13)),
                const Spacer(),
                Text('+¥$income', style: AppTextStyles.currency),
              ],
            ),
            const SizedBox(height: 8),
            Text(title, style: AppTextStyles.heading2),
            const SizedBox(height: 8),

            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.surfaceInset,
                borderRadius: BorderRadius.circular(FlRadius.sm),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('OOPZ频道/房间：548025338 (房间 $room)', style: AppTextStyles.bodyMuted),
                  const SizedBox(height: 4),
                  Text('进房密码：$pwd', style: AppTextStyles.mono.copyWith(color: AppColors.primaryLight)),
                ],
              ),
            ),
            const SizedBox(height: 12),

            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                ElevatedButton(
                  onPressed: () => _completeOrder(orderId),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.success,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(FlRadius.sm),
                    ),
                  ),
                  child: const Text('✔ 提交结单审核'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
