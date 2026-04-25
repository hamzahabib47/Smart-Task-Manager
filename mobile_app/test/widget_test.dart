import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:smart_time_manager_mobile/main.dart';

void main() {
  testWidgets('App loads auth screen', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const SmartTimeManagerApp());
    await tester.pumpAndSettle();

    expect(find.text('Smart Task Manager'), findsOneWidget);
    expect(find.text('Sign in'), findsWidgets);
  });
}
