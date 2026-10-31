import 'package:flutter/material.dart';
import '../theme/colors.dart';
import '../theme/text_styles.dart';
import '../theme/surfaces.dart';
import '../models/user.dart';
import '../services/api_service.dart';

class LoginView extends StatefulWidget {
  final Function(User user) onLoginSuccess;

  const LoginView({super.key, required this.onLoginSuccess});

  @override
  State<LoginView> createState() => _LoginViewState();
}

class _LoginViewState extends State<LoginView> {
  final ApiService _api = ApiService();
  final TextEditingController _usernameController = TextEditingController(text: '99990002');
  final TextEditingController _passwordController = TextEditingController(text: 'Linglong2026!');
  bool _loading = false;

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    final u = _usernameController.text.trim();
    final p = _passwordController.text.trim();
    if (u.isEmpty || p.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请输入打手账号与密码')),
      );
      return;
    }

    setState(() => _loading = true);
    try {
      final user = await _api.login(u, p);
      if (mounted) {
        widget.onLoginSuccess(user);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: SurfaceContainer(
          level: SurfaceLevel.card,
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.15),
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.primary, width: 2),
                ),
                alignment: Alignment.center,
                child: const Text('🐲', style: TextStyle(fontSize: 36)),
              ),
              const SizedBox(height: 16),
              const Text('灵龙电竞 · 打手接单助手', style: AppTextStyles.heading1),
              const SizedBox(height: 4),
              const Text('认证打手专属接单终端', style: AppTextStyles.caption),
              const SizedBox(height: 24),

              TextField(
                controller: _usernameController,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  labelText: '打手账号 / 手机号',
                  labelStyle: const TextStyle(color: AppColors.textMuted),
                  prefixIcon: const Icon(Icons.person, color: AppColors.primary, size: 20),
                  filled: true,
                  fillColor: AppColors.surfaceBlock,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(FlRadius.sm),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
              const SizedBox(height: 14),

              TextField(
                controller: _passwordController,
                obscureText: true,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  labelText: '登录密码',
                  labelStyle: const TextStyle(color: AppColors.textMuted),
                  prefixIcon: const Icon(Icons.lock, color: AppColors.primary, size: 20),
                  filled: true,
                  fillColor: AppColors.surfaceBlock,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(FlRadius.sm),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
              const SizedBox(height: 24),

              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _loading ? null : _handleLogin,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(FlRadius.sm),
                    ),
                  ),
                  child: Text(
                    _loading ? '正在验证身份...' : '立即登录',
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
