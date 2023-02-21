import * as reactPlugin from 'vite-plugin-react'
import type { UserConfig } from 'vite'

const config: UserConfig = {
  assetsDir: "assets",
  jsx: 'react',
  plugins: [reactPlugin]
}

export default config
