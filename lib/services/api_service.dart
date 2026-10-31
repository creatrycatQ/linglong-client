import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import '../models/order.dart';
import '../models/notice.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  String _baseUrl = 'https://www.linglong.club';
  String? _sessionCookie;
  String? _csrfToken;
  int _latencyMs = 0;

  String get baseUrl => _baseUrl;
  String? get sessionCookie => _sessionCookie;
  int get latencyMs => _latencyMs;
  bool get isLoggedIn => _sessionCookie != null && _sessionCookie!.isNotEmpty;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _baseUrl = prefs.getString('ll_base_url') ?? 'https://www.linglong.club';
    _sessionCookie = prefs.getString('ll_session_cookie');
  }

  Future<void> setBaseUrl(String url) async {
    _baseUrl = url.replaceAll(RegExp(r'/+$'), '');
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('ll_base_url', _baseUrl);
  }

  Map<String, String> _buildHeaders() {
    final headers = <String, String>{
      'Content-Type': 'application/json; charset=UTF-8',
      'Accept': 'application/json',
    };
    if (_sessionCookie != null) {
      headers['Cookie'] = 'll_session=$_sessionCookie';
    }
    if (_csrfToken != null) {
      headers['X-CSRF-Token'] = _csrfToken!;
    }
    return headers;
  }

  void _saveCookiesFromResponse(http.Response response) async {
    final rawCookie = response.headers['set-cookie'];
    if (rawCookie != null) {
      final match = RegExp(r'll_session=([^;]+)').firstMatch(rawCookie);
      if (match != null) {
        _sessionCookie = match.group(1);
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('ll_session_cookie', _sessionCookie!);
      }
    }
  }

  /// 测量与服务器的真实网络往返延迟 (Heartbeat Ping)
  Future<int> ping() async {
    final start = DateTime.now().millisecondsSinceEpoch;
    try {
      final res = await http.get(
        Uri.parse('$_baseUrl/api/health'),
        headers: _buildHeaders(),
      ).timeout(const Duration(seconds: 6));
      if (res.statusCode == 200) {
        _latencyMs = DateTime.now().millisecondsSinceEpoch - start;
      } else {
        _latencyMs = -1;
      }
    } catch (_) {
      _latencyMs = -1;
    }
    return _latencyMs;
  }

  /// 打手登录
  Future<User> login(String username, String password) async {
    final res = await http.post(
      Uri.parse('$_baseUrl/api/auth/worker/login'),
      headers: _buildHeaders(),
      body: jsonEncode({
        'username': username.trim(),
        'password': password.trim(),
      }),
    );
    _saveCookiesFromResponse(res);

    if (res.statusCode >= 200 && res.statusCode < 300) {
      final data = jsonDecode(res.body);
      if (data['csrf'] != null) {
        _csrfToken = data['csrf'].toString();
      }
      return User.fromJson(data['user'] ?? data);
    } else {
      final err = jsonDecode(res.body);
      throw Exception(err['error'] ?? '登录失败，请检查账号密码');
    }
  }

  /// 登出
  Future<void> logout() async {
    try {
      await http.post(
        Uri.parse('$_baseUrl/api/logout'),
        headers: _buildHeaders(),
      );
    } catch (_) {}
    _sessionCookie = null;
    _csrfToken = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('ll_session_cookie');
  }

  /// 获取实时订单池 (Pool)
  Future<List<Order>> getPool() async {
    final res = await http.get(
      Uri.parse('$_baseUrl/api/pool'),
      headers: _buildHeaders(),
    );
    if (res.statusCode == 200) {
      final data = jsonDecode(res.body);
      if (data is List) {
        return data.map((item) => Order.fromJson(item)).toList();
      }
      return [];
    }
    throw Exception('获取接单大厅数据失败 (${res.statusCode})');
  }

  /// 获取打手面板数据 (Dashboard)
  Future<Map<String, dynamic>> getDashboard() async {
    final res = await http.get(
      Uri.parse('$_baseUrl/api/dashboard'),
      headers: _buildHeaders(),
    );
    if (res.statusCode == 200) {
      return jsonDecode(res.body);
    }
    throw Exception('获取工作台数据失败 (${res.statusCode})');
  }

  /// 获取打手须知
  Future<Notice> getWorkerNotice() async {
    final res = await http.get(
      Uri.parse('$_baseUrl/api/worker-notice'),
      headers: _buildHeaders(),
    );
    if (res.statusCode == 200) {
      return Notice.fromJson(jsonDecode(res.body));
    }
    throw Exception('获取打手须知失败 (${res.statusCode})');
  }

  /// 标记已读
  Future<void> markWorkerNoticeRead(String readToken) async {
    await http.post(
      Uri.parse('$_baseUrl/api/worker-notice/read'),
      headers: _buildHeaders(),
      body: jsonEncode({'read_token': readToken}),
    );
  }

  /// 签署须知
  Future<Map<String, dynamic>> acceptWorkerNotice(
    String readToken,
    String ack,
    String adultAck,
  ) async {
    final res = await http.post(
      Uri.parse('$_baseUrl/api/worker-notice/accept'),
      headers: _buildHeaders(),
      body: jsonEncode({
        'read_token': readToken,
        'acknowledgement': ack,
        'adult_acknowledgement': adultAck,
      }),
    );
    if (res.statusCode == 200) {
      return jsonDecode(res.body);
    }
    final err = jsonDecode(res.body);
    throw Exception(err['error'] ?? '签署提交失败');
  }

  /// 抢单 / 加入订单
  Future<void> joinOrder(String orderId) async {
    final res = await http.post(
      Uri.parse('$_baseUrl/api/orders/$orderId/join'),
      headers: _buildHeaders(),
    );
    if (res.statusCode != 200) {
      final err = jsonDecode(res.body);
      throw Exception(err['error'] ?? '抢单失败');
    }
  }

  /// 结单 / 履约完成
  Future<void> completeOrder(String orderId) async {
    final res = await http.post(
      Uri.parse('$_baseUrl/api/orders/$orderId/complete'),
      headers: _buildHeaders(),
      body: jsonEncode({}),
    );
    if (res.statusCode != 200) {
      final err = jsonDecode(res.body);
      throw Exception(err['error'] ?? '结单失败');
    }
  }

  /// 转单
  Future<void> transferOrder(String orderId, String targetWorker) async {
    final res = await http.post(
      Uri.parse('$_baseUrl/api/orders/$orderId/transfer'),
      headers: _buildHeaders(),
      body: jsonEncode({'target_worker': targetWorker}),
    );
    if (res.statusCode != 200) {
      final err = jsonDecode(res.body);
      throw Exception(err['error'] ?? '转单失败');
    }
  }

  /// 申请提现
  Future<void> createWithdrawal(int amountCents, String method, String account) async {
    final res = await http.post(
      Uri.parse('$_baseUrl/api/withdrawals'),
      headers: _buildHeaders(),
      body: jsonEncode({
        'amount': amountCents,
        'method': method,
        'account': account,
      }),
    );
    if (res.statusCode != 200) {
      final err = jsonDecode(res.body);
      throw Exception(err['error'] ?? '提现申请失败');
    }
  }

  /// 检查客户端更新
  Future<Map<String, dynamic>> checkUpdate() async {
    final res = await http.get(
      Uri.parse('$_baseUrl/api/client/update'),
      headers: _buildHeaders(),
    );
    if (res.statusCode == 200) {
      return jsonDecode(res.body);
    }
    throw Exception('检查更新失败');
  }
}
