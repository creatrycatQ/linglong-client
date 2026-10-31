import 'dart:ui';
import 'package:flutter/material.dart';

/// FlClash 四级表面深度枚举 (Surface Depth System)
enum SurfaceLevel {
  /// 基础页面底色 (Tone 6: #060A12)
  page,

  /// 内容卡片底色 (Tone 15: #0E1828)
  card,

  /// 区块底色、分段控制器槽 (Tone 21: #15233A)
  block,

  /// 内嵌小元素、输入框、徽章槽 (Tone 27: #1C2E4C)
  inset,
}

/// FlClash 表面颜色映射
extension SurfaceLevelExtension on SurfaceLevel {
  Color get color {
    switch (this) {
      case SurfaceLevel.page:
        return const Color(0xFF060A12);
      case SurfaceLevel.card:
        return const Color(0xFF0E1828);
      case SurfaceLevel.block:
        return const Color(0xFF15233A);
      case SurfaceLevel.inset:
        return const Color(0xFF1C2E4C);
    }
  }

  SurfaceLevel get nextLevel {
    switch (this) {
      case SurfaceLevel.page:
        return SurfaceLevel.card;
      case SurfaceLevel.card:
        return SurfaceLevel.block;
      case SurfaceLevel.block:
        return SurfaceLevel.inset;
      case SurfaceLevel.inset:
        return SurfaceLevel.inset;
    }
  }
}

/// FlClash 标准 Squircle 圆角规范
class FlRadius {
  static const double xs = 4.0;
  static const double sm = 8.0;
  static const double md = 16.0;
  static const double lg = 20.0;
  static const double xl = 24.0;
  static const double xxl = 28.0;
  static const double alert = 34.0;
  static const double full = 9999.0;

  static BorderRadius get rXS => BorderRadius.circular(xs);
  static BorderRadius get rSM => BorderRadius.circular(sm);
  static BorderRadius get rMD => BorderRadius.circular(md);
  static BorderRadius get rLG => BorderRadius.circular(lg);
  static BorderRadius get rXL => BorderRadius.circular(xl);
  static BorderRadius get rXXL => BorderRadius.circular(xxl);
  static BorderRadius get rAlert => BorderRadius.circular(alert);
  static BorderRadius get rFull => BorderRadius.circular(full);
}

/// FlClash 规范表面容器组件 (SurfaceContainer)
class SurfaceContainer extends StatelessWidget {
  final SurfaceLevel level;
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final BorderRadius? borderRadius;
  final Border? customBorder;
  final bool enableBorder;
  final Color? borderColor;
  final double borderWidth;
  final VoidCallback? onTap;
  final double? width;
  final double? height;

  const SurfaceContainer({
    super.key,
    this.level = SurfaceLevel.card,
    required this.child,
    this.padding,
    this.margin,
    this.borderRadius,
    this.customBorder,
    this.enableBorder = true,
    this.borderColor,
    this.borderWidth = 0.67,
    this.onTap,
    this.width,
    this.height,
  });

  @override
  Widget build(BuildContext context) {
    final radius = borderRadius ?? FlRadius.rMD;
    final border = customBorder ??
        (enableBorder
            ? Border.all(
                color: borderColor ?? const Color(0x14FFFFFF),
                width: borderWidth,
              )
            : null);

    Widget content = Container(
      width: width,
      height: height,
      margin: margin,
      padding: padding,
      decoration: BoxDecoration(
        color: level.color,
        borderRadius: radius,
        border: border,
      ),
      child: child,
    );

    if (onTap != null) {
      return Material(
        color: Colors.transparent,
        borderRadius: radius,
        child: InkWell(
          onTap: onTap,
          borderRadius: radius,
          splashColor: const Color(0x1A48CDF5),
          highlightColor: const Color(0x0D48CDF5),
          child: content,
        ),
      );
    }

    return content;
  }
}

/// FlClash 拟态流体玻璃容器 (Liquid Glass Container)
class LiquidGlassContainer extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final BorderRadius? borderRadius;
  final double blur;
  final Color? surfaceColor;
  final Border? border;
  final VoidCallback? onTap;

  const LiquidGlassContainer({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.borderRadius,
    this.blur = 20.0,
    this.surfaceColor,
    this.border,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final radius = borderRadius ?? FlRadius.rLG;

    Widget container = ClipRRect(
      borderRadius: radius,
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            color: surfaceColor ?? const Color(0xD90E1828), // 85% card tone
            borderRadius: radius,
            border: border ??
                Border.all(
                  color: const Color(0x1FFFFFFF),
                  width: 0.67,
                ),
          ),
          child: child,
        ),
      ),
    );

    if (margin != null) {
      container = Padding(padding: margin!, child: container);
    }

    if (onTap != null) {
      return GestureDetector(
        onTap: onTap,
        child: container,
      );
    }

    return container;
  }
}
