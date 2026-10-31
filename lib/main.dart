import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'theme/colors.dart';
import 'theme/surfaces.dart';
import 'theme/text_styles.dart';
import 'models/user.dart';
import 'models/order.dart';
import 'models/notice.dart';
import 'services/api_service.dart';
import 'services/sound_service.dart';
import 'views/pool_view.dart';
import 'views/all_orders_view.dart';
import 'views/active_orders_view.dart';
import 'views/ledger_view.dart';
import 'views/notice_view.dart';
import 'views/profile_view.dart';
import 'views/settings_view.dart';
import 'views/login_view.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: AppColors.surfacePage,
    systemNavigationBarIconBrightness: Brightness.light,
  ));

  await ApiService().init();
  await SoundService().init();

  runApp(const LinglongApp());
}

class LinglongApp extends StatelessWidget {
  const LinglongApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '灵龙电竞打手助手',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        scaffoldBackgroundColor: AppColors.surfacePage,
        colorScheme: const ColorScheme.dark(
          primary: AppColors.primary,
          surface: AppColors.surfaceCard,
          background: AppColors.surfacePage,
        ),
        fontFamily: 'sans-serif',
      ),
      home: const MainScreen(),
    );
  }
}

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  final ApiService _api = ApiService();
  final SoundService _sound = SoundService();

  int _currentIndex = 0; // 0: 大厅, 1: 全部工单, 2: 履约中, 3: 财务, 4: 设置
  String? _overlayRoute; // 'notice', 'profile', 'login'
  User? _currentUser;
  Notice? _notice;
  int _latency = 0;
  Timer? _heartbeatTimer;
  int _lastOrderCount = 0;

  @override
  void initState() {
    super.initState();
    _initApp();
  }

  @override
  void dispose() {
    _heartbeatTimer?.cancel();
    super.dispose();
  }

  Future<void> _initApp() async {
    // 首次 Ping
    _latency = await _api.ping();
    if (mounted) setState(() {});

    // 如果本地已有 sessionCookie，尝试拉取个人面板和打手须知
    if (_api.isLoggedIn) {
      try {
        final dash = await _api.getDashboard();
        if (dash['user'] != null) {
          _currentUser = User.fromJson(dash['user']);
        }
      } catch (_) {}
    }

    await _fetchNotice();

    // 启动 15 秒心跳轮询
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 15), (_) async {
      final l = await _api.ping();
      if (mounted) setState(() => _latency = l);

      // 轮询检查是否有新单或专属指名订单
      try {
        final list = await _api.getPool();
        if (list.length > _lastOrderCount && _lastOrderCount > 0) {
          // 检查是否有指名单
          final nominated = list.firstWhere(
            (o) => _currentUser != null && o.isNominatedFor(_currentUser!.username),
            orElse: () => Order(
              id: '',
              title: '',
              gameDivision: '',
              type: '',
              serviceRule: '',
              status: '',
              slots: 0,
              workerCount: 0,
              paidAmount: 0,
              slotIncomes: [],
              createdAt: '',
            ),
          );
          if (nominated.id.isNotEmpty) {
            _sound.notifyDesignatedOrder(nominated);
          } else {
            _sound.playOrderChime();
          }
        }
        _lastOrderCount = list.length;
      } catch (_) {}
    });
  }

  Future<void> _fetchNotice() async {
    try {
      final n = await _api.getWorkerNotice();
      if (mounted) setState(() => _notice = n);
    } catch (_) {}
  }

  void _onNavigate(String route) {
    setState(() {
      _overlayRoute = route;
    });
  }

  @override
  Widget build(BuildContext context) {
    final hasUnsignedNotice = _currentUser != null && _notice != null && !_notice!.accepted;

    return Scaffold(
      // 沉浸式顶部标题栏 (FlClash Header)
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(56),
        child: Container(
          padding: EdgeInsets.only(
            top: MediaQuery.of(context).padding.top + 6,
            left: 16,
            right: 16,
            bottom: 8,
          ),
          decoration: BoxDecoration(
            color: AppColors.surfaceCard.withOpacity(0.85),
            border: const Border(
              bottom: BorderSide(color: AppColors.borderHairline, width: 0.67),
            ),
          ),
          child: Row(
            children: [
              // 品牌图标与标题
              GestureAppTap(
                onTap: () => setState(() => _overlayRoute = null),
                child: Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withOpacity(0.18),
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.primary, width: 1),
                      ),
                      alignment: Alignment.center,
                      child: const Text('🐲', style: TextStyle(fontSize: 16)),
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      '灵龙接单助手',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                        letterSpacing: -0.2,
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),

              // 网络延迟徽标
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.surfaceBlock,
                  borderRadius: BorderRadius.circular(FlRadius.full),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: _latency > 0 && _latency < 300
                            ? AppColors.success
                            : AppColors.accent,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      _latency > 0 ? '${_latency}ms' : '连接中',
                      style: const TextStyle(
                        fontSize: 10,
                        fontFamily: 'monospace',
                        color: AppColors.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),

              // 打手须知快捷入口
              Stack(
                children: [
                  IconButton(
                    icon: const Icon(Icons.menu_book, color: AppColors.textMuted, size: 20),
                    onPressed: () => setState(() => _overlayRoute = 'notice'),
                    tooltip: '打手须知',
                  ),
                  if (hasUnsignedNotice)
                    Positioned(
                      top: 8,
                      right: 8,
                      child: Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: AppColors.accent,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                ],
              ),

              // 用户头像 / 登录入口
              GestureDetector(
                onTap: () {
                  if (_currentUser != null) {
                    setState(() => _overlayRoute = 'profile');
                  } else {
                    setState(() => _overlayRoute = 'login');
                  }
                },
                child: Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: _currentUser != null
                        ? AppColors.primary.withOpacity(0.2)
                        : AppColors.surfaceBlock,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: _currentUser != null ? AppColors.primary : AppColors.borderHairline,
                      width: 1,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    _currentUser != null ? '🧑‍💻' : '🔑',
                    style: const TextStyle(fontSize: 14),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),

      // 视图主体
      body: _buildCurrentBody(),

      // FlClash Liquid Glass 底部导航栏
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: AppColors.surfaceCard.withOpacity(0.92),
          border: const Border(
            top: BorderSide(color: AppColors.borderHairline, width: 0.67),
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildNavItem(0, Icons.flash_on, '抢单大厅'),
                _buildNavItem(1, Icons.list_alt, '全部工单'),
                _buildNavItem(2, Icons.sports_esports, '履约中'),
                _buildNavItem(3, Icons.account_balance_wallet, '财务看板'),
                _buildNavItem(4, Icons.settings, '客户端设置'),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(int index, IconData icon, String label) {
    final isSelected = _currentIndex == index && _overlayRoute == null;
    return GestureDetector(
      onTap: () {
        setState(() {
          _currentIndex = index;
          _overlayRoute = null;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary.withOpacity(0.12) : Colors.transparent,
          borderRadius: BorderRadius.circular(FlRadius.sm),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 20,
              color: isSelected ? AppColors.primary : AppColors.textMuted,
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w400,
                color: isSelected ? AppColors.primary : AppColors.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCurrentBody() {
    if (_overlayRoute == 'notice') {
      return NoticeView(
        currentUser: _currentUser,
        notice: _notice,
        onNoticeSigned: () async {
          await _fetchNotice();
          setState(() => _overlayRoute = null);
        },
      );
    }
    if (_overlayRoute == 'profile') {
      return ProfileView(
        currentUser: _currentUser,
        onLogin: () => setState(() => _overlayRoute = 'login'),
        onLogout: () async {
          await _api.logout();
          setState(() {
            _currentUser = null;
            _overlayRoute = null;
          });
        },
      );
    }
    if (_overlayRoute == 'login') {
      return LoginView(
        onLoginSuccess: (user) async {
          setState(() {
            _currentUser = user;
            _overlayRoute = null;
          });
          await _fetchNotice();
        },
      );
    }

    switch (_currentIndex) {
      case 0:
        return PoolView(
          currentUser: _currentUser,
          notice: _notice,
          onNavigate: _onNavigate,
        );
      case 1:
        return AllOrdersView(currentUser: _currentUser);
      case 2:
        return ActiveOrdersView(currentUser: _currentUser);
      case 3:
        return LedgerView(currentUser: _currentUser);
      case 4:
      default:
        return const SettingsView();
    }
  }
}

class GestureAppTap extends StatelessWidget {
  final Widget child;
  final VoidCallback onTap;
  const GestureAppTap({super.key, required this.child, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: child,
    );
  }
}
