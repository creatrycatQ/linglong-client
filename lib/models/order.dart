class Order {
  final String id;
  final String title;
  final String gameDivision;
  final String type;
  final String serviceRule;
  final String status;
  final int slots;
  final int workerCount;
  final int paidAmount; // 单位：分
  final List<int> slotIncomes; // 单位：分
  final int? expectedIncome; // 单位：分
  final String createdAt;
  final String? publishedAt;
  final String? friendCode;
  final String? roomNumber;
  final String? roomPassword;
  final String? customerName;
  final String? customerContact;
  final String? remarks;
  final bool canJoin;
  final String? blockedReason;
  final List<dynamic> namedWorkers;
  final List<dynamic> participants;

  Order({
    required this.id,
    required this.title,
    required this.gameDivision,
    required this.type,
    required this.serviceRule,
    required this.status,
    required this.slots,
    required this.workerCount,
    required this.paidAmount,
    required this.slotIncomes,
    this.expectedIncome,
    required this.createdAt,
    this.publishedAt,
    this.friendCode,
    this.roomNumber,
    this.roomPassword,
    this.customerName,
    this.customerContact,
    this.remarks,
    this.canJoin = true,
    this.blockedReason,
    this.namedWorkers = const [],
    this.participants = const [],
  });

  factory Order.fromJson(Map<String, dynamic> json) {
    List<int> incomes = [];
    if (json['slot_incomes'] is List) {
      incomes = (json['slot_incomes'] as List)
          .map((e) => (e is num) ? e.toInt() : int.tryParse(e.toString()) ?? 0)
          .toList();
    }

    return Order(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? json['project_name']?.toString() ?? '电竞护航服务',
      gameDivision: json['game_division']?.toString() ?? 'pc-delta',
      type: json['type']?.toString() ?? 'escort',
      serviceRule: json['service_rule']?.toString() ?? 'default',
      status: json['status']?.toString() ?? 'open',
      slots: json['slots'] is num ? (json['slots'] as num).toInt() : 0,
      workerCount: json['worker_count'] is num ? (json['worker_count'] as num).toInt() : 1,
      paidAmount: json['paid_amount'] is num ? (json['paid_amount'] as num).toInt() : 0,
      slotIncomes: incomes,
      expectedIncome: json['expected_income'] is num ? (json['expected_income'] as num).toInt() : null,
      createdAt: json['created_at']?.toString() ?? '',
      publishedAt: json['published_at']?.toString(),
      friendCode: json['friend_code']?.toString() ?? json['roomDetails']?['friendCode']?.toString(),
      roomNumber: json['room_number']?.toString() ?? json['roomDetails']?['roomNumber']?.toString(),
      roomPassword: json['room_password']?.toString() ?? json['roomDetails']?['password']?.toString(),
      customerName: json['customer_name']?.toString() ?? '老板',
      customerContact: json['customer_contact']?.toString(),
      remarks: json['remarks']?.toString() ?? json['desc']?.toString(),
      canJoin: json['canJoin'] == true || json['can_join'] == true,
      blockedReason: json['blocked_reason']?.toString(),
      namedWorkers: json['named_workers'] is List ? json['named_workers'] : [],
      participants: json['participants'] is List ? json['participants'] : [],
    );
  }

  /// 格式化主打手收益 (转为元)
  String get displayEarning {
    if (expectedIncome != null && expectedIncome! > 0) {
      return (expectedIncome! / 100.0).toStringAsFixed(2);
    }
    if (slotIncomes.isNotEmpty && slotIncomes[0] > 0) {
      return (slotIncomes[0] / 100.0).toStringAsFixed(2);
    }
    if (paidAmount > 0) {
      return (paidAmount / 100.0).toStringAsFixed(2);
    }
    return '0.00';
  }

  /// 是否是老板指名订单
  bool isNominatedFor(String? username) {
    if (username == null || username.isEmpty) return false;
    return namedWorkers.any((w) => w.toString().contains(username));
  }
}
