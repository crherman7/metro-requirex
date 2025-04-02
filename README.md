<picture>
  <img alt="Metro RequireX Banner" src="./.github/assets/banner.png">
</picture>

<br/>
<br/>

<div align="center">
<a href="https://www.npmjs.com/package/@metro-requirex/react-native"><img src="https://img.shields.io/npm/v/metro-requirex.svg?style=flat" alt="npm version"></a>
<a href="https://www.npmjs.com/package/@metro-requirex/react-native"><img src="https://img.shields.io/npm/dm/metro-requirex.svg?style=flat" alt="Downloads"></a>
<a href="https://bundlephobia.com/package/@metro-requirex/react-native"><img src="https://img.shields.io/bundlephobia/minzip/metro-requirex" alt="Bundle Size"></a>
<a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-Ready-blue.svg" alt="TypeScript"></a>
<a href="LICENSE.md"><img src="https://img.shields.io/github/license/crherman7/metro-requirex.svg" alt="License"></a>
<a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"></a>
</div>

> **Dynamic Module Loading and Runtime Execution for React Native using Metro**

`metro-requirex` is a utility for **dynamically loading modules** and **executing JavaScript code** in a React Native environment, leveraging Metro Bundler. With `metro-requirex`, developers can bypass traditional static `require()` statements, allowing for **runtime module resolution** and **dynamic code execution**.

## **Table of Contents**

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [Dynamic Module Loading](#dynamic-module-loading)
  - [Executing Dynamic Code](#executing-dynamic-code)
  - [Dynamically Evaluating React Components](#dynamically-evaluating-react-components)
- [API Reference](#api-reference)
  - [`requirex`](#requirex)
  - [`evalx`](#evalx)
- [How It Works](#how-it-works)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

## **Overview**

`metro-requirex` allows for dynamic module loading and evaluation in React Native without modifying Metro itself. It ensures **consistent** and **efficient** resolution of modules at runtime, providing a seamless experience for developers who need **runtime flexibility** within their applications.

## **Features**

- **Dynamic Module Resolution**: Load and execute modules dynamically at runtime, even for modules that are bundled with Metro.
- **Eval Support**: Execute JavaScript dynamically using `evalx()` with support for module imports and exports.
- **React Component Support**: Dynamically load and render React Native components at runtime without needing to rebuild.
- **Zero Metro Modifications**: Utilizes Metro’s internal module resolution and `__r()` function for compatibility.
- **Safe Execution**: Uses `new Function()` for sandboxed execution, ensuring performance is not impacted.

## **Installation**

Install `metro-requirex` via npm or yarn:

```sh
yarn add @metro-requirex/react-native
yarn add -D @metro-requirex/metro-config
```

or

```sh
npm install @metro-requirex/react-native
npm install @metro-requirex/metro-config --save-dev
```

## **Configuration**

To ensure that `metro-requirex` works correctly with your React Native project, you need to update your **metro.config.js** file. This step integrates the necessary configuration provided by `@metro-requirex/metro-config`.

Update your **metro.config.js** as follows:

```js
const {getDefaultConfig} = require('@react-native/metro-config');
const {withMetroRequirexConfig} = require('@metro-requirex/metro-config');

module.exports = withMetroRequirexConfig(getDefaultConfig(__dirname));
```

If you already have a custom Metro configuration, you can merge it with the configuration returned by `withMetroRequirexConfig(...)`. This updated configuration ensures the proper resolution of module IDs and supports dynamic module loading at runtime.

## **Usage**

### **Dynamic Module Loading**

You can load Metro-bundled modules dynamically using the `requirex()` function:

```js
import {requirex} from 'metro-requirex';

const lodash = requirex('lodash');
console.log(lodash.camelCase('hello world')); // Output: "helloWorld"
```

### **Executing Dynamic Code**

Execute arbitrary JavaScript code dynamically with module imports using `evalx()`:

```js
import {evalx} from 'metro-requirex';

const code = `
  const _ = require("lodash");
  module.exports = _.kebabCase("React Native Rocks!");
`;

console.log(evalx(code)); // Output: "react-native-rocks"
```

### **Dynamically Evaluating React Components**

You can dynamically create and render React Native components at runtime:

```js
import {evalx} from 'metro-requirex';
import {View, Text} from 'react-native';

const componentCode = `
  module.exports = () => {
    return React.createElement("Text", null, "Hello from a dynamic component!");
  };
`;

const DynamicComponent = evalx(componentCode);

export default function App() {
  return (
    <View>
      <DynamicComponent />
    </View>
  );
}
```

## **API Reference**

### **`requirex(moduleName: string): any`**

Dynamically loads a module within Metro Bundler.

#### **Parameters**

- `moduleName` _(string)_: The name of the module to load.

#### **Returns**

- The module’s exports if found.
- `null` if the module cannot be resolved.

#### **Example**

```js
const moment = requirex('moment');
console.log(moment().format('YYYY-MM-DD'));
```

### **`evalx(code: string): any`**

Executes JavaScript code dynamically, supporting module imports.

#### **Parameters**

- `code` _(string)_: The JavaScript code to execute.

#### **Returns**

- The value of `module.exports` from the executed code.

#### **Example**

```js
const result = evalx(`
  module.exports = "Dynamic Execution!";
`);
console.log(result); // Output: "Dynamic Execution!"
```

## **How It Works**

### **Dynamic Module Resolution**

1. **MD5 Hashing for Module ID**: We generate deterministic numeric IDs for modules using **MD5 hashing** of the module path. This ensures that modules always receive the same ID across builds and executions.

2. **External Modules**: For modules in `node_modules`, we compute a hash of the module's relative path within `node_modules` to resolve it dynamically.

3. **Internal Modules**: For internal project files, we compute the relative path from the project root and map it to a unique ID to ensure consistent resolution across different builds.

4. **Module Resolution at Runtime**: Once the correct module ID is computed, we use **Metro’s internal `__r()` function** to dynamically load the module during runtime.

### **Dynamic Code Execution with `evalx()`**

1. **Sandboxed Execution**: The `evalx()` function uses **`new Function()`** to execute JavaScript code in a secure, isolated environment.

2. **Module Imports**: The evaluated code has access to `requirex()`, allowing it to dynamically import modules.

3. **Return Value**: The function returns `module.exports` from the executed code, mimicking the CommonJS module system.

## **Contributing**

We welcome contributions to `metro-requirex`! If you’d like to contribute, please follow the steps below:

1. Fork the repository on GitHub.
2. Clone your forked repository to your local machine.
3. Create a new branch for your feature or bug fix.
4. Make your changes and commit them with descriptive messages.
5. Push your changes to your forked repository.
6. Open a pull request to the main repository.

For more detailed contributing instructions, check out the [Contributing Guide](CONTRIBUTING.md).

## **License**

This project is licensed under the **MIT License**. See the [LICENSE.md](LICENSE.md) file for more details.
