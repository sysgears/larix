import { AppLoading, registerRootComponent } from 'expo';
import Constants from 'expo-constants';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import React from 'react';
import { View } from 'react-native';

import App from './App';

interface AwakeInDevAppProps {
  exp: any;
}

interface AwakeInDevAppState {
  isReady: boolean;
}

// we don't want this to require transformation
class AwakeInDevApp extends React.Component<AwakeInDevAppProps, AwakeInDevAppState> {
  constructor(props: AwakeInDevAppProps) {
    super(props);
    this.state = { isReady: false };
  }

  public async componentDidMount() {
    this.setState({ isReady: true });
  }

  public render() {
    if (!this.state.isReady) {
      return <AppLoading startAsync={null} onError={null} onFinish={null} />;
    }

    return React.createElement(
      View,
      {
        style: {
          flex: 1,
          marginTop: Constants.statusBarHeight
        }
      },
      React.createElement(App, { ...this.props }),
      React.createElement(View)
    );
  }

  public _activate() {
    if (process.env.NODE_ENV === 'development') {
      activateKeepAwake();
    }
  }

  public _deactivate() {
    if (process.env.NODE_ENV === 'development') {
      deactivateKeepAwake();
    }
  }
}

registerRootComponent(AwakeInDevApp);
