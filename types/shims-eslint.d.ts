declare module 'eslint/config' {
  export const globalIgnores: any
}
declare module '@vue/eslint-config-typescript' {
  export const defineConfigWithVueTs: any
  export const vueTsConfigs: any
}
declare module '@vue/eslint-config-prettier/skip-formatting' {
  const skipFormatting: any
  export default skipFormatting
}
declare module 'eslint-plugin-vue' {
  const pluginVue: any
  export default pluginVue
}

