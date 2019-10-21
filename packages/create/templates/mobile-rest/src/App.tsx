import axios from 'axios';
import React from 'react';
import { Text, View } from 'react-native';
import * as url from 'url';

const REST_API_PROD_URL = 'https://example.com:8080/api';

interface ServerHelloProps {
  apiUrl: string;
}

interface ServerHelloState {
  isLoading: boolean;
  error: string;
  data: { message: string };
}

class ServerHello extends React.Component<ServerHelloProps> {
  public state: ServerHelloState = { isLoading: true, data: null, error: null };

  constructor(props: ServerHelloProps) {
    super(props);
  }

  public async componentDidMount() {
    try {
      const result = await axios(`${this.props.apiUrl}/hello?subject=World`);

      this.setState({
        isLoading: false,
        data: result.data
      });
    } catch (e) {
      this.setState({
        isLoading: false,
        error: e.message
      });
    }
  }

  public render() {
    if (this.state.isLoading) {
      return <Text>Loading...</Text>;
    }

    return (
      <Text>
        Server Salutation:&nbsp;
        {this.state.error
          ? this.state.error + '. You probably don`t have REST API Server running at the moment - thats okay'
          : this.state.data.message}
      </Text>
    );
  }
}

interface AppProps {
  exp: any;
}

const App = (props: AppProps) => {
  const apiUrl =
    process.env.NODE_ENV !== 'production'
      ? `http://${url.parse(props.exp.manifest.bundleUrl).hostname}:8080/api`
      : REST_API_PROD_URL;

  return (
    <View>
      <Text>Welcome to your own REST mobile front end!</Text>
      <Text>You can start editing source code and see results immediately</Text>
      <ServerHello apiUrl={apiUrl} />
    </View>
  );
};

export default App;
