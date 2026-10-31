import 'package:flutter/material.dart';
import '../theme/colors.dart';
import '../theme/text_styles.dart';
import '../theme/surfaces.dart';
import '../models/order.dart';
import '../models/user.dart';
import '../services/api_service.dart';

class AllOrdersView extends StatefulWidget {
  final User? currentUser;
  const AllOrdersView({super.key, required this.currentUser});

  @override
  State<AllOrdersView> createState() => _AllOrdersViewState();
}

class _AllOrdersViewState extends State<AllOrdersView> {
  final ApiService _api = ApiService();

  bool _isPlatformScope = true; // true: 全平台工单池, false: 我的接单记录
  List<Order> _poolOrders = [];
  List<dynamic> _myOrders = [];
  bool _loading = false;
  String _statusFilter = 'all';

  @override
  void initState() {
    super.initState();
    _fetchOrders();
  }

  Future<void> _fetchOrders() async {
    setState(() => _loading = true);
    try {
      final pool = await _api.getPool();
      _poolOrders = pool;
    } catch (_) {}

    if (widget.currentUser != null) {
      try {
        final dash = await _api.getDashboard();
        if (dash['workerOrders'] is List) {
          _myOrders = dash['workerOrders'];
        }
      } catch (_) {}
    }

    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: AppColors.primary,
      backgroundColor: AppColors.surfaceCard,
      onRefresh: _fetchOrders,
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        children: [
          const Text('📋 全部订单中心', style: AppTextStyles.heading1),
          const SizedBox(height: 4),
          const Text('全平台工单池概览与个人履约历史记录', style: AppTextStyles.caption),
          const SizedBox(height: 14),

          // 范围切换分段选择器 (FlClash Segmented Control)
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: AppColors.surfaceBlock,
              borderRadius: BorderRadius.circular(FlRadius.sm),
            ),
            child: Row(
              children: [
                Expanded(
                  child: _buildScopeTab(
                    title: '全平台工单池 (${_poolOrders.length})',
                    active: _isPlatformScope,
                    onTap: () => setState(() => _isPlatformScope = true),
                  ),
                ),
                Expanded(
                  child: _buildScopeTab(
                    title: '我的接单记录 (${_myOrders.length})',
                    active: !_isPlatformScope,
                    onTap: () => setState(() => _isPlatformScope = false),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          if (_loading)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(40),
                child: CircularProgressIndicator(color: AppColors.primary),
              ),
            )
          else if (_isPlatformScope)
            ..._buildPlatformOrdersList()
          else
            ..._buildMyOrdersList(),
        ],
      ),
    );
  }

  Widget _buildScopeTab({
    required String title,
    required bool active,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: active ? AppColors.primary.withOpacity(0.2) : Colors.transparent,
          borderRadius: BorderRadius.circular(FlRadius.xs),
          border: active ? Border.all(color: AppColors.primary, width: 0.67) : null,
        ),
        child: Text(
          title,
          style: TextStyle(
            fontSize: 12,
            fontWeight: active ? FontWeight.w700 : FontWeight.w400,
            color: active ? AppColors.primary : AppColors.textMuted,
          ),
        ),
      ),
    );
  }

  List<Widget> _buildPlatformOrdersList() {
    if (_poolOrders.isEmpty) {
      return const [
        Center(
          child: Padding(
            padding: EdgeInsets.all(40),
            child: Text('暂无全平台工单', style: AppTextStyles.bodyMuted),
          ),
        )
      ];
    }
    return _poolOrders.map((order) {
      return Container(
        margin: const EdgeInsets.only(bottom: 10),
        child: SurfaceContainer(
          level: SurfaceLevel.card,
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(order.title, style: AppTextStyles.heading3),
                    const SizedBox(height: 4),
                    Text(
                      '${order.gameDivision == 'pc-delta' ? 'PC三角洲' : '手游三角洲'} · 席位 ${order.slots}/${order.workerCount}',
                      style: AppTextStyles.caption,
                    ),
                  ],
                ),
              ),
              Text(
                '¥${order.displayEarning}',
                style: AppTextStyles.currency,
              ),
            ],
          ),
        ),
      );
    }).toList();
  }

  List<Widget> _buildMyOrdersList() {
    if (widget.currentUser == null) {
      return const [
        Center(
          child: Padding(
            padding: EdgeInsets.all(40),
            child: Text('请先登录后查看个人接单记录', style: AppTextStyles.bodyMuted),
          ),
        )
      ];
    }
    if (_myOrders.isEmpty) {
      return const [
        Center(
          child: Padding(
            padding: EdgeInsets.all(40),
            child: Text('暂无个人接单记录', style: AppTextStyles.bodyMuted),
          ),
        )
      ];
    }
    return _myOrders.map((item) {
      final title = item['title']?.toString() ?? '电竞服务';
      final status = item['status']?.toString() ?? 'service';
      final income = item['my_income'] is num
          ? ((item['my_income'] as num) / 100.0).toStringAsFixed(2)
          : '0.00';

      return Container(
        margin: const EdgeInsets.only(bottom: 10),
        child: SurfaceContainer(
          level: SurfaceLevel.card,
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: AppTextStyles.heading3),
                    const SizedBox(height: 4),
                    Text('状态：$status', style: AppTextStyles.caption),
                  ],
                ),
              ),
              Text('¥$income', style: AppTextStyles.currency),
            ],
          ),
        ),
      );
    }).toList();
  }
}
