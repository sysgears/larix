# Larix Package Manager

[![npm version](https://badge.fury.io/js/larix.svg)](https://badge.fury.io/js/larix)
[![Twitter Follow](https://img.shields.io/twitter/follow/sysgears.svg?style=social)](https://twitter.com/sysgears)

## Usage

1. Install `larix` globally
```
yarn global add larix
```

2. Create empty folder, say `myapp`, inside this folder run
```
larix init
```
just hit Enter on every question.

3. Add prefab package from npm registry via `larix`
```
larix add @gqlapp/module-server-ts
```

4. Try to modify source code of prefabs and then
```
larix remove @gqlapp/module-server-ts
```
check, that your changes were saved in a `.patch` file, then readd module again via
```
larix add @gqlapp/module-server-ts
```
and check that the patch was applied and your changes are on their places again.

## License

Copyright © 2019 [SysGears (Cyprus) Limited]. This source code is licensed under the [MIT] license.

[MIT]: LICENSE
[SysGears (Cyprus) Limited]: http://sysgears.com
