import { createShopScene } from "./shop-scene"

const view = document.getElementById("view")!
const status = document.getElementById("status")!
let timer = 0
const handle = createShopScene(view, (msg) => {
  status.textContent = msg
  status.classList.add("show")
  clearTimeout(timer)
  timer = window.setTimeout(() => status.classList.remove("show"), 2600)
})
;(window as unknown as { __shop: typeof handle }).__shop = handle
