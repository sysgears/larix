# Zen Scripts

Zen provides four commands and a few [options](#running-zen-commands-with-options) you can run the commands with.

## `zen watch`

Runs the project in development mode with live code reload for all the platforms:

```bash
zen watch
```

## `zen build`

Builds your project for production: the build code is minified.

Note that the project won't run, Zen will only generate and minify the build, and also save the generated files under
the `build` directory. The `build` directory is automatically created under the **current working directory**. To change
the directory where Zen will store the built production code, consult the [configuration] guide.

```bash
zen build
```

## `zen start`

Builds your project for production and runs the project in the browser. The code is minified.

```bash
zen start
```

## `zen test`

Runs all the tests using `mocha-webpack`.

```bash
zen test
```

## Running Zen commands with options

You can run Zen commands using the following options:

* `-n`, shows the list of builders
* `-d`, disables builders
* `-e`, enables builders
* `-v`, shows generated configurations in the console

You can specify the option after the Zen command:

```bash
zen <command> <option>
```

For example, you can tell Zen to log out them by running the commands with the `-v` option:

```bash
zen watch -v
```

If your project has several Zen builders, and you want to only run specific builders without changing Zen
configurations, you can run a command this way:

```bash
zen watch -d ios -e web
```

The command above disables the iOS build and enables the web build (the client-side application).

[configuration]: https://github.com/sysgears/larix/blob/master/packages/zen/docs/configuration.md#buildDir
