import 'package:shared_preferences/shared_preferences.dart';

class SessionStore {
  static const _cookieKey = 'officegpt_auth_cookie';

  Future<String?> readCookie() async =>
      (await SharedPreferences.getInstance()).getString(_cookieKey);
  Future<void> saveCookie(String cookie) async =>
      (await SharedPreferences.getInstance()).setString(_cookieKey, cookie);
  Future<void> clear() async =>
      (await SharedPreferences.getInstance()).remove(_cookieKey);
}
