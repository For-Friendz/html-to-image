import { Options } from './types'
import { embedResources } from './embed-resources'
import { toArray, isInstanceOfElement } from './util'
import { isDataUrl } from './dataurl'

async function embedProp(
  propName: string,
  node: HTMLElement,
  options: Options,
) {
  const propValue = node.style?.getPropertyValue(propName)
  if (propValue) {
    const cssString = await embedResources(propValue, null, options)
    node.style.setProperty(
      propName,
      cssString,
      node.style.getPropertyPriority(propName),
    )
    return true
  }
  return false
}

async function embedBackground<T extends HTMLElement>(
  clonedNode: T,
  options: Options,
) {
  if (!(await embedProp('background', clonedNode, options))) {
    await embedProp('background-image', clonedNode, options)
  }
  if (!(await embedProp('mask', clonedNode, options))) {
    await embedProp('mask-image', clonedNode, options)
  }
}

async function embedImageNode<T extends HTMLElement | SVGImageElement>(
  clonedNode: T,
) {
  const isImageElement = isInstanceOfElement(clonedNode, HTMLImageElement)

  if (
    !(isImageElement && !isDataUrl(clonedNode.src)) &&
    !(
      isInstanceOfElement(clonedNode, SVGImageElement) &&
      !isDataUrl(clonedNode.href.baseVal)
    )
  ) {
    return
  }

  const url = isImageElement ? clonedNode.src : clonedNode.href.baseVal

  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const blob = await response.blob()
    const objectURL = window.URL.createObjectURL(blob)

    await new Promise<void>((resolve, reject) => {
      // clonedNode.onload = () => {
      //   resolve()
      //   // Revoke the object URL after the image has loaded to free up memory
      //   window.URL.revokeObjectURL(objectURL)
      // }
      clonedNode.onerror = (e) => reject(new Error(`Image loading error: ${e}`))

      const image = clonedNode as HTMLImageElement
      if (image.decode) {
        image.decode().then(resolve).catch(reject)
      }

      if (image.loading === 'lazy') {
        image.loading = 'eager'
      }

      if (isImageElement) {
        clonedNode.srcset = ''
        clonedNode.src = objectURL
      } else {
        ;(clonedNode as SVGImageElement).href.baseVal = objectURL
      }
    })
  } catch (error) {
    //
  }
}

async function embedChildren<T extends HTMLElement>(
  clonedNode: T,
  options: Options,
) {
  const children = toArray<HTMLElement>(clonedNode.childNodes)
  const deferreds = children.map((child) => embedImages(child, options))
  await Promise.all(deferreds).then(() => clonedNode)
}

export async function embedImages<T extends HTMLElement>(
  clonedNode: T,
  options: Options,
) {
  if (isInstanceOfElement(clonedNode, Element)) {
    await embedBackground(clonedNode, options)
    await embedImageNode(clonedNode)
    await embedChildren(clonedNode, options)
  }
}
