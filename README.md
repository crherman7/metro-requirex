<picture>
  <img alt="Metro RequireX Banner" src="./.github/assets/banner.png">
</picture>

<br/>
<br/>

<div align="center">
<a href="https://www.npmjs.com/package/@crherman7/metro-requirex"><img src="https://img.shields.io/npm/v/metro-requirex.svg?style=flat" alt="npm version"></a>
<a href="https://www.npmjs.com/package/@crherman7/metro-requirex"><img src="https://img.shields.io/npm/dm/metro-requirex.svg?style=flat" alt="Downloads"></a>
<a href="https://bundlephobia.com/package/@crherman7/metro-requirex"><img src="https://img.shields.io/bundlephobia/minzip/metro-requirex" alt="Bundle Size"></a>
<a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-Ready-blue.svg" alt="TypeScript"></a>
<a href="LICENSE.md"><img src="https://img.shields.io/github/license/crherman7/metro-requirex.svg" alt="License"></a>
<a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"></a>
</div>

> **Dynamically require and execute modules at runtime in React Native (Metro Bundler).**

`metro-requirex` enables **dynamic module resolution and execution** in React Native using Metro Bundler. It provides a **safe, efficient, and Metro-compatible** way to dynamically `require()` modules and evaluate JavaScript code at runtime.

---

## **✨ Features**

✅ **Dynamic Requires** – Load Metro-bundled modules at runtime.
✅ **Eval Support** – Execute JavaScript snippets with built-in `requirex()`.
✅ **Works with React Components** – Load and render dynamic React Native components.
✅ **No Metro Modifications** – Uses `require.resolveWeak()` and Metro's internal loader.
✅ **Safe & Performant** – Isolated execution with `new Function()`.

## **📦 Installation**

```sh
yarn add metro-requirex
```

or

```sh
npm install metro-requirex
```

## **🚀 Usage**

### **1️⃣ Dynamic Module Loading**

Use `requirex()` to dynamically load Metro-bundled modules.

```js
import {requirex} from 'metro-requirex';

const lodash = requirex('lodash');
console.log(lodash.camelCase('hello world')); // "helloWorld"
```

### **2️⃣ Executing Dynamic Code**

Use `evalx()` to **execute JavaScript dynamically**, supporting module imports.

```js
import {evalx} from 'metro-requirex';

const code = `
  const _ = require("lodash");
  module.exports = _.kebabCase("React Native Rocks!");
`;

console.log(evalx(code)); // "react-native-rocks"
```

### **3️⃣ Dynamically Evaluating a React Component**

Since JSX is **already transformed**, you can evaluate and render React Native components dynamically.

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

## **📌 API Reference**

### **🔹 `requirex(moduleName: string): any`**

> Dynamically loads a module in Metro.

#### **Parameters**

- `moduleName` _(string)_: The name of the module to require.

#### **Returns**

- The module’s exports if found.
- `null` if the module does not exist.

#### **Example**

```js
const moment = requirex('moment');
console.log(moment().format('YYYY-MM-DD'));
```

### **🔹 `evalx(code: string): any`**

> Executes JavaScript dynamically, supporting module imports.

#### **Parameters**

- `code` _(string)_: The JavaScript code to execute.

#### **Returns**

- The value of `module.exports` in the executed code.

#### **Example**

```js
const result = evalx(`
  module.exports = "Dynamic Execution!";
`);
console.log(result); // "Dynamic Execution!"
```

## **🛠 How It Works**

### 🔹 **How `requirex()` Works**

Metro Bundler assigns **opaque numeric IDs** to modules at build time, meaning `require('module')` doesn’t work dynamically.
Instead, `requirex()`:

1. Calls **`require.resolveWeak(moduleName)`** to retrieve Metro’s internal module ID.
2. Calls **Metro’s internal `__r(moduleId)`** to fetch the module dynamically.

### 🔹 **How `evalx()` Works**

1. Uses **`new Function()`** to create a sandboxed execution scope.
2. Injects **`requirex()`** so that evaluated code can import modules dynamically.
3. Returns **`module.exports`**, mimicking a CommonJS module system.

## **🧪 Testing**

Run the test suite to verify functionality:

```sh
yarn test
```

## **📦 Contributing**

Contributions are welcome! To get started:

1. Clone the repo:

   ```sh
   git clone https://github.com/crherman7/metro-requirex.git
   ```

2. Install dependencies:

   ```sh
   yarn install
   ```

3. Make your changes and submit a pull request.

## **📜 License**

Licensed under the **MIT License**.

## **🌟 Why Use `metro-requirex`?**

If you need **dynamic module loading** or **evaluating JavaScript dynamically in React Native**, `metro-requirex` makes it **fast, safe, and easy**—without needing Metro modifications.

🚀 **Ready to supercharge your React Native app?** Install `metro-requirex` today! 🎉
