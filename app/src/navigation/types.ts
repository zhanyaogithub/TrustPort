export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  Contacts: undefined;
  NewRelation: undefined;
  ConfirmRelation: {otherAddress: string};
  Transfer: { contactAddress?: string };
  TransactionHistory: undefined;
  Settings: undefined;
};
