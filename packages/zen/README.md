# Zen

[![Join the chat at https://gitter.im/sysgears/zen](https://badges.gitter.im/sysgears/zen.svg)](https://gitter.im/sysgears/zen)
[![npm version](https://badge.fury.io/js/%40larix2Fzen.svg)](https://badge.fury.io/js/%40larix2Fzen) [![Twitter Follow](https://img.shields.io/twitter/follow/sysgears.svg?style=social)](https://twitter.com/sysgears)

## Description

Zen is a build tool that can create project builds for production, run them in test mode, and launch your project in
watch mode for development without the need for you to configure the builds. To make this possible, Zen analyzes
your project structure and dependencies and decides how to build the project. And unlike many similar build tools,
Zen doesn't tie you to a specific framework or lock you out from the generated configurations &ndash; you can
customize the project configurations however you need.

To reach the goal, Zen reads the `package.json` file as well as the actually installed dependencies in the
`node_modules` directory and then automatically configures the technologies it knows about using custom [plugins].
Zen also understands whether you're developing a standalone project, a Lerna monorepo, or a Yarn Workspaces project
to decide how it should be built.

In doing so, Zen relieves you from the pains of configuring the project builds for client, server, and native mobile
applications so you can focus on development.

The bottom line is that Zen does its best to provide you with an advanced build setup using the minimal information
about the technology stack while still giving you the ability to configure every aspect of how your project gets built.

## Installation

Install Zen in development dependencies of your project using Yarn:

```bash
yarn add @larix/zen --dev
```

Alternately, you can use NPM:

```bash
npm install @larix/zen --save-dev
```

## Getting Started

To start using Zen, you only need to create a basic project and then install the necessary dependencies (including
Zen). You can then build and run your project with Zen using the command below:

```bash
# Without scripts
yarn zen start
```

Zen will [build your project for development] and launch it in watch mode: upon changes in code, Zen will rebuild
the project and reload the build using hot code reload or live code reload.

**NOTE**: If you're using NPM rather than Yarn, you need to add a few scripts to `package.json` to be able to run your
project with Zen.

## Zen Documentation

You can follow to the documentation to learn more about Zen:

* [Concepts]
* [Configuration]
* [Programmatic Usage]
* [How Zen Works]
* [Zen Scripts]

## Community Support

* [Gitter channel] - ask your questions, find answers, and participate in general discussions!
* [GitHub issues] - submit issues and request new features!

## Commercial Support

The [SysGears] team provides advanced support for commercial partners. A commercial partner will have premium access to
our team to get help with Zen. Contact us using [Skype] or via email **info@sysgears.com**.

## Contributors

Very many thanks to our contributors ([emoji key]):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors] specification.
We welcome any contributions to the project!

## License

Copyright © 2018-2019 [SysGears (Cyprus) Limited]. This source code is licensed under the [MIT] license.

[webpack]: https://webpack.js.org/
[plugins]: https://github.com/sysgears/larix/blob/master/packages/zen/docs/concepts.md#plugins
[zen scripts]: https://github.com/sysgears/larix/blob/master/packages/zen/docs/scripts.md
[build your project for development]: https://github.com/sysgears/larix/blob/master/packages/zen/docs/scripts.md#zen-watch
[Concepts]: https://github.com/sysgears/larix/blob/master/packages/zen/docs/concepts.md
[Configuration]: https://github.com/sysgears/larix/blob/master/packages/zen/docs/configuration.md
[How Zen Works]: https://github.com/sysgears/larix/blob/master/packages/zen/docs/howZenWorks.md
[Programmatic Usage]: https://github.com/sysgears/larix/blob/master/packages/zen/docs/programmatic.md
[Zen Scripts]: https://github.com/sysgears/larix/blob/master/packages/zen/docs/scripts.md
[Gitter channel]: https://gitter.im/sysgears/zen
[GitHub issues]: https://github.com/sysgears/larix/issues
[SysGears]: https://sysgears.com
[skype]: http://hatscripts.com/addskype?sysgears
[emoji key]: https://github.com/kentcdodds/all-contributors#emoji-key
[all-contributors]: https://github.com/kentcdodds/all-contributors
[SysGears (Cyprus) Limited]: http://sysgears.com
[MIT]: LICENSE
