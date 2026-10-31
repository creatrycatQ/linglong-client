class User {
  final String id;
  final String username;
  final String nickname;
  final String phone;
  final String workerStatus;
  final String workerDivision;
  final String? workerNoticeVersion;
  final String? workerNoticeAt;
  final int creditScore;
  final int balance;
  final bool isAdmin;

  User({
    required this.id,
    required this.username,
    required this.nickname,
    required this.phone,
    required this.workerStatus,
    required this.workerDivision,
    this.workerNoticeVersion,
    this.workerNoticeAt,
    this.creditScore = 100,
    this.balance = 0,
    this.isAdmin = false,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id']?.toString() ?? '',
      username: json['username']?.toString() ?? '',
      nickname: json['nickname']?.toString() ?? json['username']?.toString() ?? '灵龙打手',
      phone: json['phone']?.toString() ?? '',
      workerStatus: json['worker_status']?.toString() ?? 'none',
      workerDivision: json['worker_division']?.toString() ?? 'pc-delta',
      workerNoticeVersion: json['worker_notice_version']?.toString(),
      workerNoticeAt: json['worker_notice_at']?.toString(),
      creditScore: json['credit_score'] is num ? (json['credit_score'] as num).toInt() : 100,
      balance: json['balance'] is num ? (json['balance'] as num).toInt() : 0,
      isAdmin: json['is_admin'] == 1 || json['is_admin'] == true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'username': username,
        'nickname': nickname,
        'phone': phone,
        'worker_status': workerStatus,
        'worker_division': workerDivision,
        'worker_notice_version': workerNoticeVersion,
        'worker_notice_at': workerNoticeAt,
        'credit_score': creditScore,
        'balance': balance,
        'is_admin': isAdmin,
      };
}
