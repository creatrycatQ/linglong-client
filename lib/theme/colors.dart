import 'package:flutter/material.dart';

/// FlClash 色彩与状态系统 (SeededColorScheme)
class AppColors {
  // 品牌色与状态高光色 (专用于状态与交互指示)
  static const Color primary = Color(0xFF48CDF5); // 灵龙主色调 (亮青蓝)
  static const Color primaryLight = Color(0xFF86E2FF);
  static const Color primaryDark = Color(0xFF0284C7);
  static const Color accent = Color(0xFFF59E0B); // 琥珀黄 / 警示
  static const Color success = Color(0xFF10B981); // 成功翠绿
  static const Color danger = Color(0xFFEF4444); // 错误/阻断猩红

  // 表面层级色 (4-tier surfaces)
  static const Color surfacePage = Color(0xFF060A12); // Tone 6
  static const Color surfaceCard = Color(0xFF0E1828); // Tone 15
  static const Color surfaceBlock = Color(0xFF15233A); // Tone 21
  static const Color surfaceInset = Color(0xFF1C2E4C); // Tone 27

  // 文字与层级色
  static const Color textMain = Color(0xFFFFFFFF);
  static const Color textMuted = Color(0xFF8EA3BF);
  static const Color textDim = Color(0xFF5A6E85);
  static const Color textDisabled = Color(0xFF384759);

  // 边框微光线 (Hairline Borders)
  static const Color borderHairline = Color(0x14FFFFFF); // 0.67dp hairline
  static const Color borderActive = Color(0x4048CDF5);
  static const Color borderWarning = Color(0x40F59E0B);

  // 阴影与光晕 (Subtle Ambient Glow)
  static List<BoxShadow> get primaryGlow => [
        const BoxShadow(
          color: Color(0x3348CDF5),
          blurRadius: 16,
          offset: Offset(0, 4),
        )
      ];

  static List<BoxShadow> get cardElevation => [
        const BoxShadow(
          color: Color(0x40000000),
          blurRadius: 12,
          offset: Offset(0, 6),
        )
      ];
}
