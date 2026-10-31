import 'package:flutter/material.dart';
import '../theme/colors.dart';
import '../theme/text_styles.dart';
import '../theme/surfaces.dart';
import '../models/order.dart';
import '../models/user.dart';
import '../models/notice.dart';
import '../services/api_service.dart';
import '../services/sound_service.dart';

class PoolView extends StatefulWidget {
  final User? currentUser;
  final Notice? notice;
  final Function(String route) onNavigate;

  const PoolView({
    super.key,
    required this.currentUser,
    required this.notice,
    required this.onNavigate,
  });

  @override
  State<PoolView> createState() => _PoolViewState();
}

class _PoolViewState extends State<PoolView> {
  final ApiService _api = ApiService();
  final SoundService _sound = SoundService();

  List<Order> _orders = [];
  bool _loading = false;
  String _selectedDivision = 'all'; // all, pc-delta, mobile-delta

  @override
  void initState() {
    super.initState();
    _loadPool();
  }

  Future<void> _loadPool() async {
    setState(() => _loading = true);
    try {
      final list = await _api.getPool();
      setState(() {
        _orders = list;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  List<Order> get _filteredOrders {
    if (_selectedDivision == 'all') return _orders;
    return _orders.where((o) => o.gameDivision == _selectedDivision).toList();
  }

  Future<void> _joinOrder(Order order) async {
    if (widget.currentUser == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请先登录打手账号')),
      );
      widget.onNavigate('login');
      return;
    }
    if (widget.notice != null && !widget.notice!.accepted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请先在打手须知中完成协议签署方可抢单')),
      );
      widget.onNavigate('notice');
      return;
    }

    try {
      await _api.joinOrder(order.id);
      _sound.playOrderChime();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('🎉 抢单成功！已加入履约队列')),
        );
        _loadPool();
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
    final hasUnsignedNotice = widget.currentUser != null &&
        widget.notice != null &&
        !widget.notice!.accepted;

    return RefreshIndicator(
      color: AppColors.primary,
      backgroundColor: AppColors.surfaceCard,
      onRefresh: _loadPool,
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        children: [
          // 顶部状态提示
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('⚡ 接单大厅', style: AppTextStyles.heading1),
                  const SizedBox(height: 4),
                  Text(
                    '实时总池：${_orders.length} 单 · 毫秒级刷新',
                    style: AppTextStyles.caption,
                  ),
                ],
              ),
              IconButton(
                icon: const Icon(Icons.refresh, color: AppColors.primary),
                onPressed: _loadPool,
                tooltip: '刷新订单池',
              ),
            ],
          ),
          const SizedBox(height: 12),

          // 未签署须知提示横幅
          if (hasUnsignedNotice) ...[
            SurfaceContainer(
              level: SurfaceLevel.block,
              borderColor: AppColors.borderWarning,
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  const Text('⚠️', style: TextStyle(fontSize: 22)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          '尚未确认最新版《打手服务须知》',
                          style: TextStyle(
                            color: AppColors.accent,
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: 2),
                        const Text(
                          '根据安全公约，请阅读至末尾完成签署后方可接单',
                          style: TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: () => widget.onNavigate('notice'),
                    style: TextButton.styleFrom(
                      foregroundColor: AppColors.primary,
                    ),
                    child: const Text('去签署 →'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],

          // 分类过滤 Chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildFilterChip('all', '全部单池 (${_orders.length})'),
                const SizedBox(width: 8),
                _buildFilterChip('pc-delta', 'PC三角洲'),
                const SizedBox(width: 8),
                _buildFilterChip('mobile-delta', '手游三角洲'),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // 订单列表
          if (_loading && _orders.isEmpty)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(40),
                child: CircularProgressIndicator(color: AppColors.primary),
              ),
            )
          else if (_filteredOrders.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(40),
                child: Column(
                  children: const [
                    Text('🍃', style: TextStyle(fontSize: 40)),
                    SizedBox(height: 10),
                    Text('当前暂无待抢订单', style: AppTextStyles.bodyMuted),
                  ],
                ),
              ),
            )
          else
            ..._filteredOrders.map((order) => _buildOrderCard(order)),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String id, String label) {
    final isSelected = _selectedDivision == id;
    return GestureDetector(
      onTap: () => setState(() => _selectedDivision = id),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary.withOpacity(0.15) : AppColors.surfaceBlock,
          borderRadius: BorderRadius.circular(FlRadius.sm),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.borderHairline,
            width: isSelected ? 1.0 : 0.67,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
            color: isSelected ? AppColors.primary : AppColors.textMuted,
          ),
        ),
      ),
    );
  }

  Widget _buildOrderCard(Order order) {
    final isPc = order.gameDivision == 'pc-delta';
    final isNominated = widget.currentUser != null &&
        order.isNominatedFor(widget.currentUser!.username);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: SurfaceContainer(
        level: SurfaceLevel.card,
        borderColor: isNominated ? AppColors.accent : AppColors.borderHairline,
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 卡片头部
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: isPc
                        ? AppColors.primary.withOpacity(0.2)
                        : const Color(0xFF10B981).withOpacity(0.2),
                    borderRadius: BorderRadius.circular(FlRadius.xs),
                  ),
                  child: Text(
                    isPc ? 'PC 三角洲' : '手游三角洲',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: isPc ? AppColors.primary : AppColors.success,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                if (isNominated)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppColors.accent.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(FlRadius.xs),
                    ),
                    child: const Text(
                      '⭐ 老板指名',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppColors.accent,
                      ),
                    ),
                  ),
                const Spacer(),
                Text(
                  '+¥${order.displayEarning}',
                  style: AppTextStyles.currency,
                ),
              ],
            ),
            const SizedBox(height: 8),

            // 标题
            Text(order.title, style: AppTextStyles.heading2),
            const SizedBox(height: 6),

            // 联络/密码信息
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.surfaceInset,
                borderRadius: BorderRadius.circular(FlRadius.sm),
              ),
              child: Row(
                children: [
                  const Icon(Icons.meeting_room, size: 14, color: AppColors.textDim),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      isPc
                          ? 'OOPZ频道：548025338  |  密码：${order.roomPassword ?? '接单后可见'}'
                          : '好友加队码：${order.friendCode ?? '接单后可见'}',
                      style: AppTextStyles.mono.copyWith(color: AppColors.textMuted),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // 底部按钮栏
            Row(
              children: [
                Text(
                  '席位：${order.slots}/${order.workerCount}',
                  style: AppTextStyles.caption,
                ),
                const Spacer(),
                if (!order.canJoin && order.blockedReason != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.danger.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(FlRadius.sm),
                    ),
                    child: Text(
                      order.blockedReason!,
                      style: const TextStyle(
                        color: AppColors.danger,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  )
                else
                  ElevatedButton(
                    onPressed: () => _joinOrder(order),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.black,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(FlRadius.sm),
                      ),
                    ),
                    child: const Text('⚡ 立即抢单', style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
