import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {WalletProvider} from './src/hooks/useWallet';
import {ContactsProvider} from './src/hooks/useContacts';
import {RootStackParamList} from './src/navigation/types';

// Screens
import OnboardingScreen from './src/screens/OnboardingScreen';
import HomeScreen from './src/screens/HomeScreen';
import ContactsScreen from './src/screens/ContactsScreen';
import NewRelationScreen from './src/screens/NewRelationScreen';
import ConfirmRelationScreen from './src/screens/ConfirmRelationScreen';
import TransferScreen from './src/screens/TransferScreen';
import TransactionHistoryScreen from './src/screens/TransactionHistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

function App() {
  return (
    <SafeAreaProvider>
      <WalletProvider>
        <ContactsProvider>
          <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Onboarding"
            screenOptions={{
              headerStyle: {backgroundColor: '#1a1a2e'},
              headerTintColor: '#fff',
              headerTitleStyle: {fontWeight: 'bold'},
            }}>
            <Stack.Screen
              name="Onboarding"
              component={OnboardingScreen}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{
                headerShown: false,
                gestureEnabled: false,
              }}
            />
            <Stack.Screen
              name="Contacts"
              component={ContactsScreen}
              options={{title: '可信联系人'}}
            />
            <Stack.Screen
              name="NewRelation"
              component={NewRelationScreen}
              options={{title: '分享二维码'}}
            />
            <Stack.Screen
              name="ConfirmRelation"
              component={ConfirmRelationScreen}
              options={{title: '扫码确认'}}
            />
            <Stack.Screen
              name="Transfer"
              component={TransferScreen}
              options={{title: '转账'}}
            />
            <Stack.Screen
              name="TransactionHistory"
              component={TransactionHistoryScreen}
              options={{title: '交易记录'}}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{title: '设置'}}
            />
          </Stack.Navigator>
        </NavigationContainer>
        </ContactsProvider>
      </WalletProvider>
    </SafeAreaProvider>
  );
}

export default App;
