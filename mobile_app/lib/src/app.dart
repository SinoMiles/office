import 'package:flutter/material.dart';

import 'app_state.dart';
import 'pages/chat_page.dart';
import 'pages/login_page.dart';
import 'theme.dart';

class OfficeGptApp extends StatefulWidget {
  const OfficeGptApp({super.key});
  @override
  State<OfficeGptApp> createState() => _OfficeGptAppState();
}

class _OfficeGptAppState extends State<OfficeGptApp> {
  final state = AppState();
  @override
  void initState() {
    super.initState();
    state.initialize();
  }

  @override
  void dispose() {
    state.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'OfficeGPT',
    debugShowCheckedModeBanner: false,
    theme: officeTheme(),
    home: AnimatedBuilder(
      animation: state,
      builder: (context, _) {
        if (!state.initialized) return const _Splash();
        return state.user == null
            ? LoginPage(state: state)
            : ChatPage(appState: state);
      },
    ),
  );
}

class _Splash extends StatelessWidget {
  const _Splash();
  @override
  Widget build(BuildContext context) => const Scaffold(
    body: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          BrandIcon(size: 58),
          SizedBox(height: 18),
          Text(
            'OfficeGPT',
            style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800),
          ),
          SizedBox(height: 22),
          CircularProgressIndicator(strokeWidth: 2),
        ],
      ),
    ),
  );
}

class BrandIcon extends StatelessWidget {
  const BrandIcon({super.key, this.size = 40});
  final double size;
  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: const BoxDecoration(
      shape: BoxShape.circle,
      color: Color(0xFFD1FAE5),
    ),
    child: Icon(
      Icons.auto_awesome_rounded,
      color: officeGreen,
      size: size * .56,
    ),
  );
}
