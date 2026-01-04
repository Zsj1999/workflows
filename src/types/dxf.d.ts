declare module 'dxf' {
  export type DxfPolyline = {
    rgb?: [number, number, number]
    layer?: any
    vertices?: Array<[number, number]>
  }
  export type DxfToPolylinesResult = {
    bbox?: any
    polylines?: DxfPolyline[]
  }
  export class Helper {
    constructor(src: string)
    parsed: any
    denormalised: any
    toSVG(): string
    toPolylines(): DxfToPolylinesResult
  }
}
