import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../app.dart';
import '../app_state.dart';
import '../services/api_client.dart';
import '../theme.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, required this.state});
  final AppState state;
  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final phone = TextEditingController();
  final password = TextEditingController();
  final sms = TextEditingController();
  final captchaAnswer = TextEditingController();
  bool smsMode = false,
      obscure = true,
      agreed = false,
      loading = false,
      sending = false;
  String? error, captchaId, captchaImage;

  @override
  void dispose() {
    phone.dispose();
    password.dispose();
    sms.dispose();
    captchaAnswer.dispose();
    super.dispose();
  }

  Future<void> loadCaptcha() async {
    try {
      final value = await widget.state.api.captcha();
      setState(() {
        captchaId = value['id'];
        captchaImage = value['image'];
      });
    } catch (e) {
      setState(() => error = '$e');
    }
  }

  Future<void> sendCode() async {
    if (captchaId == null || captchaAnswer.text.length != 4) {
      setState(() => error = '请先输入 4 位图形验证码');
      return;
    }
    setState(() {
      sending = true;
      error = null;
    });
    try {
      await widget.state.api.sendSms(
        phone.text,
        captchaId!,
        captchaAnswer.text,
      );
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('验证码已发送')));
    } catch (e) {
      setState(() => error = '$e');
      await loadCaptcha();
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  Future<void> submit() async {
    if (!agreed) {
      final accept = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('请确认服务协议'),
          content: const Text('登录即表示您同意《服务条款》和《隐私政策》。是否同意并继续？'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('取消'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('同意并登录'),
            ),
          ],
        ),
      );
      if (accept != true) return;
      setState(() => agreed = true);
    }
    setState(() {
      loading = true;
      error = null;
    });
    try {
      if (smsMode) {
        await widget.state.smsLogin(phone.text, sms.text);
      } else {
        await widget.state.passwordLogin(phone.text, password.text);
      }
    } on ApiException catch (e) {
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Stack(
      children: [
        const Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFFECFDF5),
                  Color(0xFFF8FAFC),
                  Color(0xFFEFF6FF),
                ],
              ),
            ),
          ),
        ),
        SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: Card(
                  elevation: 12,
                  shadowColor: const Color(0x220F172A),
                  surfaceTintColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(28),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(28),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            BrandIcon(size: 46),
                            SizedBox(width: 12),
                            Text(
                              'OfficeGPT',
                              style: TextStyle(
                                fontSize: 27,
                                fontWeight: FontWeight.w800,
                                color: ink,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        const Text(
                          '登录后开始处理您的文档',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Color(0xFF64748B)),
                        ),
                        const SizedBox(height: 26),
                        SegmentedButton<bool>(
                          segments: const [
                            ButtonSegment(value: false, label: Text('密码登录')),
                            ButtonSegment(value: true, label: Text('短信登录')),
                          ],
                          selected: {smsMode},
                          onSelectionChanged: (value) {
                            setState(() {
                              smsMode = value.first;
                              error = null;
                            });
                            if (value.first && captchaId == null) loadCaptcha();
                          },
                        ),
                        const SizedBox(height: 20),
                        TextField(
                          controller: phone,
                          keyboardType: TextInputType.phone,
                          maxLength: 11,
                          decoration: const InputDecoration(
                            labelText: '手机号',
                            prefixIcon: Icon(Icons.phone_iphone_rounded),
                            counterText: '',
                          ),
                        ),
                        const SizedBox(height: 14),
                        if (!smsMode)
                          TextField(
                            controller: password,
                            obscureText: obscure,
                            decoration: InputDecoration(
                              labelText: '密码',
                              prefixIcon: const Icon(
                                Icons.lock_outline_rounded,
                              ),
                              suffixIcon: IconButton(
                                onPressed: () =>
                                    setState(() => obscure = !obscure),
                                icon: Icon(
                                  obscure
                                      ? Icons.visibility_outlined
                                      : Icons.visibility_off_outlined,
                                ),
                              ),
                            ),
                          ),
                        if (smsMode) ...[
                          Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: captchaAnswer,
                                  keyboardType: TextInputType.number,
                                  maxLength: 4,
                                  decoration: const InputDecoration(
                                    labelText: '图形验证码',
                                    counterText: '',
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              InkWell(
                                onTap: loadCaptcha,
                                borderRadius: BorderRadius.circular(12),
                                child: Container(
                                  width: 118,
                                  height: 58,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF1F5F9),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: captchaImage == null
                                      ? const Text(
                                          '点击加载',
                                          style: TextStyle(color: officeGreen),
                                        )
                                      : SvgPicture.memory(
                                          base64Decode(
                                            captchaImage!.split(',').last,
                                          ),
                                          fit: BoxFit.contain,
                                        ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: sms,
                                  keyboardType: TextInputType.number,
                                  maxLength: 6,
                                  decoration: const InputDecoration(
                                    labelText: '短信验证码',
                                    counterText: '',
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              SizedBox(
                                height: 56,
                                child: OutlinedButton(
                                  onPressed: sending ? null : sendCode,
                                  child: Text(sending ? '发送中' : '发送验证码'),
                                ),
                              ),
                            ],
                          ),
                        ],
                        if (error != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 14),
                            child: Text(
                              error!,
                              style: const TextStyle(color: Color(0xFFDC2626)),
                            ),
                          ),
                        const SizedBox(height: 18),
                        Row(
                          children: [
                            Checkbox(
                              value: agreed,
                              activeColor: officeGreen,
                              onChanged: (value) =>
                                  setState(() => agreed = value ?? false),
                            ),
                            const Expanded(
                              child: Text(
                                '我已阅读并同意《服务条款》和《隐私政策》',
                                style: TextStyle(
                                  fontSize: 12.5,
                                  color: Color(0xFF64748B),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        SizedBox(
                          height: 54,
                          child: FilledButton(
                            onPressed: loading ? null : submit,
                            style: FilledButton.styleFrom(
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                            ),
                            child: loading
                                ? const SizedBox.square(
                                    dimension: 22,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Text(
                                    '登录',
                                    style: TextStyle(
                                      fontSize: 17,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    ),
  );
}
