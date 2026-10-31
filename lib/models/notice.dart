class Notice {
  final String version;
  final String title;
  final String text;
  final String textHash;
  final bool accepted;
  final String? acceptedAt;
  final String? readToken;
  final String acknowledgement;

  Notice({
    required this.version,
    required this.title,
    required this.text,
    required this.textHash,
    required this.accepted,
    this.acceptedAt,
    this.readToken,
    required this.acknowledgement,
  });

  factory Notice.fromJson(Map<String, dynamic> json) {
    return Notice(
      version: json['version']?.toString() ?? 'V4.0',
      title: json['title']?.toString() ?? '灵龙电竞打手服务公约与安全须知',
      text: json['text']?.toString() ?? '',
      textHash: json['text_hash']?.toString() ?? '',
      accepted: json['accepted'] == true,
      acceptedAt: json['accepted_at']?.toString(),
      readToken: json['read_token']?.toString(),
      acknowledgement: json['acknowledgement']?.toString() ?? '我已阅读新版须知内容',
    );
  }
}
