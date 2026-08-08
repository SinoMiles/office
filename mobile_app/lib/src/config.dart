class AppConfig {
  static const serverUrl = String.fromEnvironment(
    'OFFICEGPT_SERVER_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );

  static Uri http(String path) => Uri.parse('$serverUrl$path');
  static Uri ws(String path) {
    final base = Uri.parse(serverUrl);
    return base.replace(
      scheme: base.scheme == 'https' ? 'wss' : 'ws',
      path: path,
    );
  }
}
