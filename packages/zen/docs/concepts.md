# Concepts

Zen comes with two key concepts &ndash; [builders](#builders) and [plugins](#plugins).

## Builders

A Zen **builder** is an object that contains configurations for a specific platform &ndash; client, server, or
mobile (Android or iOS), according to the application type you're developing. Zen automatically creates a builder
object for your project using the default configurations, so you don't need to configure Zen.

However, if your project needs to be built for different platforms, for example, for the client and server, you need to
create a Zen configuration file and specify different settings for several builders. Zen also allows you to
reuse the same configurations across multiple builders.

You can specify the builder settings in the following files in the `builders` property:

* `.zenrc`
* `.zenrc.js`
* `.zenrc.json`
* `package.json`

The `.zenrc.json`, `.zenrc`, or `.zenrc.js` files must be located in the root project directory next to
`package.json`. If you're using separate packages, you can specify the builder properties in the package root.

The following example shows how you can add a builder into a `package.json` file:

```json
{
  "zen": "webpack:babel:apollo:server"
}
```

The configuration above will tell Zen that you want to build a server project with webpack, Babel, and Apollo.

You can configure Zen to set up and launch multiple builders in parallel. For that, you can use the property
`builders`:

```json
{
    "zen": {
        "builders": {
            "server": {
                "stack": "webpack:babel:apollo:ts:server"
            },
            "web": {
                "stack": "webpack:babel:apollo:react:styled-components:sass:web"
            },
            "mobile": {
                "stack": "webpack:babel:apollo:react-native:styled-components:sass:ios"
            }
        }
    }
}
```

Otherwise, you can add a `.zenrc.js` file and configure several builders with various options there:

```js
// Zen configuration for multiple builders
let config = {
  builders: {
    server: {
      stack: "webpack:babel:apollo:ts:server",
      enabled: true
    },
    web: {
      stack: "webpack:babel:apollo:react:styled-components:sass:web",
      enabled: true
    },
    mobile: {
      stack: "webpack:babel:apollo:react-native:styled-components:sass:ios",
      enabled: false
    }
  }
};
```

## Plugins

Zen comes with many plugins that handle generation of build configurations. Each Zen plugin is responsible for its
own subset of technologies that you specify in the stack.

For instance, if you're building a React application for the web platform, it's likely you're using the following stack:

* React
* Babel
* Webpack
* Some CSS preprocessor

Each of the mentioned dependency is managed by it's own plugin. For example, the Zen plugin `ReactPlugin` configures
webpack for React; similarly, `BabelPlugin` handles the Babel settings, `WebpackPlugin` handles the basic webpack
configurations, and so on.

Currently, Zen has the following plugins:

* AngularPlugin
* ApolloPlugin
* BabelPlugin
* CssProcessorPlugin
* FlowRuntimePlugin
* I18NextPlugin
* ReactHotLoaderPlugin
* ReactNativePlugin
* ReactNativeWebPlugin
* ReactPlugin
* StyledComponentsPlugin
* TCombPlugin
* TypeScriptPlugin
* VuePlugin
* WebAssetsPlugin
* WebpackPlugin

You can add your own external plugins by specifying them inside the [`plugins`] property in `.zenrc.js`.

[`plugins`]: https://github.com/sysgears/larix/blob/master/packages/zen/docs/configuration.md#plugins
