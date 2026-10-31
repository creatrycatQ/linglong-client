import 'package:flutter/material.dart';
import '../theme/colors.dart';
import '../theme/text_styles.dart';
import '../theme/surfaces.dart';
import '../models/user.dart';

class ProfileView extends StatelessWidget {
  final User? currentUser;
  final VoidCallback onLogin;
  final VoidCallback onLogout;

  const ProfileView({
    super.key,
    required this.currentUser,
    required this.onLogin,
    required this.onLogout,
  });

  @override
  Widget build(BuildContext context) {
    if (currentUser == null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('👤', style: TextStyle(fontSize: 48)),
            const SizedBox(height: 12),
            const Text('未登录打手账号', style: AppTextStyles.heading2),
            const SizedBox(height: 6),
            const Text('登录后可查看打手等级、履约星级与信用档案', style: AppTextStyles.bodyMuted),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: onLogin,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(FlRadius.sm),
                ),
              ),
              child: const Text('立即登录', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      );
    }

    final user = currentUser!;

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      children: [
        const Text('👤 打手档案与信用', style: AppTextStyles.heading1),
        const SizedBox(height: 4),
        const Text('灵龙认证王牌打手档案与履约信誉评价', style: AppTextStyles.caption),
        const SizedBox(height: 16),

        // 头部打手信息卡片
        SurfaceContainer(
          level: SurfaceLevel.card,
          padding: const EdgeInsets.all(20),
          child: Row(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.15),
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.primary, width: 1.5),
                ),
                alignment: Alignment.center,
                child: const Text('🐲', style: TextStyle(fontSize: 28)),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(user.nickname, style: AppTextStyles.heading2),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(FlRadius.xs),
                          ),
                          child: const Text('Lv.5 顶峰打手',
                              style: TextStyle(
                                  color: AppColors.primary,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text('账号：${user.username}  |  电话：${user.phone}', style: AppTextStyles.caption),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // 信用与评分指标
        Row(
          children: [
            Expanded(
              child: SurfaceContainer(
                level: SurfaceLevel.card,
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    const Text('🌟 履约好评率', style: AppTextStyles.caption),
                    const SizedBox(height: 8),
                    const Text('100.0%',
                        style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                            color: AppColors.success,
                            fontFamily: 'monospace')),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: SurfaceContainer(
                level: SurfaceLevel.card,
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    const Text('🛡️ 平台信誉分', style: AppTextStyles.caption),
                    const SizedBox(height: 8),
                    Text('${user.creditScore} 分',
                        style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                            color: AppColors.primary,
                            fontFamily: 'monospace')),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),

        // 退出登录按钮
        SizedBox(
          width: double.infinity,
          child: OutlinedButton(
            onPressed: onLogout,
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.danger,
              side: const BorderSide(color: AppColors.danger, width: 0.67),
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(FlRadius.sm),
              ),
            ),
            child: const Text('退出登录'),
          ),
        ),
      ],
    );
  }
}
