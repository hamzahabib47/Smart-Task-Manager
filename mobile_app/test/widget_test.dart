import 'package:flutter_test/flutter_test.dart';

import 'package:smart_time_manager_mobile/main.dart';

void main() {
  testWidgets('App loads auth screen', (WidgetTester tester) async {
    await tester.pumpWidget(const SmartTimeManagerApp());

    expect(find.text('Smart Time Manager'), findsOneWidget);
    expect(find.text('Login'), findsWidgets);
  });
}
