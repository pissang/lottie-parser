import * as Lottie from './lottie.type';
import type { ElementProps, EllipseProps, PathProps, RectProps } from 'zrender';
import { util } from 'zrender';
import { install } from './installLottieShapes';

interface KeyframeAnimationKeyframe {
  easing?: string;
  percent: number;
  [key: string]: any;
}

interface KeyframeAnimation {
  duration?: number;
  delay?: number;
  easing?: number;
  keyframes?: Record<string, any>[];
}

class ParseContext {
  frameTime = 1000 / 30;
  startFrame = 0;
  endFrame: number;
}

function isNumberArray(val: any): val is number[] {
  return Array.isArray(val) && typeof val[0] === 'number';
}

function isMultiDimensionalValue(val?: { k?: any }): val is { k: number[] } {
  return isNumberArray(val?.k);
}

function isMultiDimensionalKeyframedValue(val?: {
  k?: any;
}): val is { k: Lottie.OffsetKeyframe[] } {
  const k = val?.k;
  return Array.isArray(k) && k[0].t !== undefined && isNumberArray(k[0].s);
}

function isValue(val?: { k?: any }): val is { k: number } {
  // TODO is [100] sort of value?
  return typeof val?.k === 'number';
}

function isKeyframedValue(val?: {
  k?: any;
}): val is { k: Lottie.OffsetKeyframe[] } {
  const k = val?.k;
  return Array.isArray(k) && k[0].t !== undefined && typeof k[0].s === 'number';
}

function toColorString(val: number | number[]) {
  return `rgba(${[
    Math.round(getMultiDimensionValue(val, 0) * 255),
    Math.round(getMultiDimensionValue(val, 1) * 255),
    Math.round(getMultiDimensionValue(val, 2) * 255),
    getMultiDimensionValue(val, 3),
  ].join(',')})`;
}

function getMultiDimensionValue(val: number | number[], dimIndex?: number) {
  // TODO Validate?
  return val != null
    ? typeof val === 'number'
      ? val
      : val[dimIndex || 0]
    : NaN;
}

function getMultiDimensionEasingBezierString(
  kf: Pick<Lottie.OffsetKeyframe, 'o' | 'i'>,
  nextKf: Pick<Lottie.OffsetKeyframe, 'o' | 'i'>,
  dimIndex?: number
) {
  let bezierEasing: number[] = [];
  bezierEasing.push(
    kf.o?.x ? getMultiDimensionValue(kf.o.x, dimIndex) : 0,
    kf.o?.y ? getMultiDimensionValue(kf.o.y, dimIndex) : 0,
    nextKf?.o?.x ? getMultiDimensionValue(nextKf.o.x, dimIndex) : 1,
    nextKf?.o?.y ? getMultiDimensionValue(nextKf.o.y, dimIndex) : 1
  );

  if (
    bezierEasing[0] &&
    bezierEasing[1] &&
    bezierEasing[2] !== 1 &&
    bezierEasing[3] !== 1
  ) {
    return `cubic-bezier(${bezierEasing.join(',')})`;
  }
  return;
}

function parseOffsetKeyframe(
  kfs: Lottie.OffsetKeyframe[],
  targetPropName: string,
  propNames: string[],
  keyframeAnimations: KeyframeAnimation[],
  context: ParseContext,
  convertVal?: (val: number) => number
) {
  const kfsLen = kfs.length;
  const start = kfs[0].t;
  const end = kfs[kfsLen - 1].t;
  const duration = end - start;

  // TODO merge if bezier easing is same.
  for (let dimIndex = 0; dimIndex < propNames.length; dimIndex++) {
    const outKeyframes: KeyframeAnimationKeyframe[] = [];
    const propName = propNames[dimIndex];
    for (let i = 0; i < kfsLen; i++) {
      const kf = kfs[i];
      const nextKf = kfs[i + 1];
      const outKeyframe: KeyframeAnimationKeyframe = {
        easing: getMultiDimensionEasingBezierString(kf, nextKf, dimIndex),
        percent: (kf.t - start) / duration,
      };
      // Last keyframe may not have value.
      if (kf.s) {
        let val = getMultiDimensionValue(kf.s, dimIndex);
        if (convertVal) {
          val = convertVal(val);
        }
        (targetPropName
          ? (outKeyframe[targetPropName] = {} as any)
          : outKeyframe)[propName] = val;
      }
      outKeyframes.push(outKeyframe);
    }
    if (outKeyframes.length) {
      keyframeAnimations.push({
        duration: duration * context.frameTime,
        delay: start * context.frameTime,
        keyframes: outKeyframes,
      });
    }
  }
}

function parseColorOffsetKeyframe(
  kfs: Lottie.OffsetKeyframe[],
  targetPropName: string,
  propName: string,
  keyframeAnimations: KeyframeAnimation[],
  context: ParseContext
) {
  const kfsLen = kfs.length;
  const start = kfs[0].t;
  const end = kfs[kfsLen - 1].t;
  const duration = end - start;

  const outKeyframes: KeyframeAnimationKeyframe[] = [];

  for (let i = 0; i < kfsLen; i++) {
    const kf = kfs[i];
    const nextKf = kfs[i + 1];
    const outKeyframe: KeyframeAnimationKeyframe = {
      // Only use the first easing. TODO: Different easing?
      easing: getMultiDimensionEasingBezierString(kf, nextKf, 0),
      percent: (kf.t - start) / duration,
    };
    // Last keyframe may not have value.
    if (kf.s) {
      (targetPropName
        ? (outKeyframe[targetPropName] = {} as any)
        : outKeyframe)[propName] = toColorString(kf.s);
    }
    outKeyframes.push(outKeyframe);
  }
  if (outKeyframes.length) {
    keyframeAnimations.push({
      duration: duration * context.frameTime,
      delay: start * context.frameTime,
      keyframes: outKeyframes,
    });
  }
}

function parseValue(
  lottieVal: Lottie.MultiDimensional | Lottie.Value,
  attrs: Record<string, any>,
  targetPropName: string,
  propNames: string[],
  animations: KeyframeAnimation[],
  context: ParseContext,
  convertVal?: (val: number) => number
) {
  if (targetPropName) {
    attrs[targetPropName] = attrs[targetPropName] || {};
  }
  const target = targetPropName ? attrs[targetPropName] : attrs;

  if (isValue(lottieVal)) {
    const val = lottieVal.k;
    target[propNames[0]] = convertVal ? convertVal(val) : val;
  } else if (isKeyframedValue(lottieVal)) {
    parseOffsetKeyframe(
      lottieVal.k,
      targetPropName,
      propNames,
      animations,
      context,
      convertVal
    );
  } else if (isMultiDimensionalValue(lottieVal)) {
    for (let i = 0; i < propNames.length; i++) {
      const val = getMultiDimensionValue(lottieVal.k, i);
      target[propNames[i]] = convertVal ? convertVal(val) : val;
    }
  } else if (isMultiDimensionalKeyframedValue(lottieVal)) {
    // TODO Merge dimensions
    parseOffsetKeyframe(
      lottieVal.k,
      targetPropName,
      propNames,
      animations,
      context,
      convertVal
    );
  }
}

function parseTransforms(
  ks: Lottie.Transform,
  attrs: ElementProps,
  animations: KeyframeAnimation[],
  context: ParseContext
) {
  parseValue(ks.p, attrs, '', ['x', 'y'], animations, context);
  parseValue(
    ks.s,
    attrs,
    '',
    ['scaleX', 'scaleY'],
    animations,
    context,
    (val) => val / 100
  );
  parseValue(
    ks.r,
    attrs,
    '',
    ['rotation'],
    animations,
    context,
    // zrender has inversed rotation
    (val) => -(val / 180) * Math.PI
  );
  parseValue(ks.a, attrs, '', ['originX', 'originY'], animations, context);

  // TODO opacity.
  // TODO sk: skew, sa: skew axis
  // TODO px, py
}

function parseFill(
  fl: Lottie.FillShape,
  attrs: PathProps,
  animations: KeyframeAnimation[],
  context: ParseContext
) {
  attrs.style = attrs.style || {};
  // Color
  if (isMultiDimensionalValue(fl.c)) {
    attrs.style.fill = toColorString(fl.c.k);
  } else if (isMultiDimensionalKeyframedValue(fl.c)) {
    parseColorOffsetKeyframe(fl.c.k, 'style', 'fill', animations, context);
  }

  // Opacity
  parseValue(
    fl.o,
    attrs,
    'style',
    ['fillOpacity'],
    animations,
    context,
    (opacity) => opacity / 100
  );
}

function parseStroke(
  st: Lottie.StrokeShape,
  attrs: PathProps,
  animations: KeyframeAnimation[],
  context: ParseContext
) {
  attrs.style = attrs.style || {};
  // Color
  if (isMultiDimensionalValue(st.c)) {
    attrs.style.stroke = toColorString(st.c.k);
  } else if (isMultiDimensionalKeyframedValue(st.c)) {
    parseColorOffsetKeyframe(st.c.k, 'style', 'stroke', animations, context);
  }

  // Opacity
  parseValue(
    st.o,
    attrs,
    'style',
    ['strokeOpacity'],
    animations,
    context,
    (opacity) => opacity / 100
  );
  // Line width
  parseValue(st.w, attrs, 'style', ['lineWidth'], animations, context);

  switch (st.lj) {
    case Lottie.LineJoin.Bevel:
      attrs.style.lineJoin = 'bevel';
      break;
    case Lottie.LineJoin.Round:
      attrs.style.lineJoin = 'round';
      break;
    case Lottie.LineJoin.Miter:
      attrs.style.lineJoin = 'miter';
      break;
  }

  switch (st.lc) {
    case Lottie.LineCap.Butt:
      attrs.style.lineCap = 'butt';
      break;
    case Lottie.LineCap.Round:
      attrs.style.lineCap = 'round';
      break;
    case Lottie.LineCap.Square:
      attrs.style.lineCap = 'square';
      break;
  }
}

function isBezier(k: any): k is Lottie.Bezier {
  return k && k.i && k.o && k.v;
}
function parseShapePaths(
  shape: Lottie.PathShape,
  animations: KeyframeAnimation[],
  context: ParseContext
) {
  const attrs: any = {
    type: 'lottie-shape-path',
  };
  if (isBezier(shape.ks.k)) {
    attrs.shape = {
      in: shape.ks.k.i,
      out: shape.ks.k.o,
      v: shape.ks.k.v,
      close: shape.ks.k.c,
    };
  } else if (Array.isArray(shape.ks.k)) {
    const kfs = shape.ks.k;
    const kfsLen = kfs.length;
    const start = kfs[0].t;
    const end = kfs[kfsLen - 1].t;
    const duration = end - start;

    const outKeyframes: KeyframeAnimationKeyframe[] = [];

    for (let i = 0; i < kfsLen; i++) {
      const kf = kfs[i];
      const nextKf = kfs[i + 1];
      const outKeyframe: KeyframeAnimationKeyframe = {
        // Only use the first easing. TODO: Different easing?
        easing: getMultiDimensionEasingBezierString(kf, nextKf, 0),
        percent: (kf.t - start) / duration,
      };
      // Last keyframe may not have value.
      if (kf.s && kf.s.length) {
        // TODO why s is array?
        outKeyframe.shape = {
          in: kf.s[0].i,
          out: kf.s[0].o,
          v: kf.s[0].v,
          close: kf.s[0].c,
        };
      }
      outKeyframes.push(outKeyframe);
    }
    if (outKeyframes.length) {
      animations.push({
        duration: duration * context.frameTime,
        delay: start * context.frameTime,
        keyframes: outKeyframes,
      });
    }
  }
  return attrs;
}

function parseShapeRect(
  shape: Lottie.RectShape,
  animations: KeyframeAnimation[],
  context: ParseContext
) {
  const attrs = {
    type: 'rect',
    shape: {},
  } as RectProps;

  parseValue(shape.p, attrs, 'shape', ['x', 'y'], animations, context);
  parseValue(shape.s, attrs, 'shape', ['width', 'height'], animations, context);
  parseValue(shape.r, attrs, 'shape', ['r'], animations, context);

  return attrs;
}

function parseShapeEllipse(
  shape: Lottie.EllipseShape,
  animations: KeyframeAnimation[],
  context: ParseContext
) {
  const attrs: any = {
    type: 'lottie-shape-ellipse',
    shape: {},
  };

  parseValue(shape.p, attrs, 'shape', ['cx', 'cy'], animations, context);
  parseValue(shape.s, attrs, 'shape', ['rx', 'ry'], animations, context);
  return attrs;
}

function createShapes(layer: Lottie.ShapeLayer, context: ParseContext) {
  function tryCreateShape(
    shape: Lottie.ShapeElement,
    keyframeAnimations: KeyframeAnimation[]
  ) {
    let ecEl: any;
    switch (shape.ty) {
      case Lottie.ShapeType.Path:
        ecEl = parseShapePaths(
          shape as Lottie.PathShape,
          keyframeAnimations,
          context
        );
        break;
      case Lottie.ShapeType.Ellipse:
        ecEl = parseShapeEllipse(
          shape as Lottie.EllipseShape,
          keyframeAnimations,
          context
        );
        break;
      case Lottie.ShapeType.Rect:
        ecEl = parseShapeRect(
          shape as Lottie.RectShape,
          keyframeAnimations,
          context
        );
        break;
    }
    return ecEl;
  }

  function parseIterations(shapes: Lottie.ShapeElement[]) {
    const ecEls: any[] = [];
    const attrs: Record<string, any> = {};
    const keyframeAnimations: KeyframeAnimation[] = [];
    shapes.forEach((shape) => {
      let ecEl;
      switch (shape.ty) {
        case Lottie.ShapeType.Group:
          ecEl = {
            type: 'group',
            children: parseIterations((shape as Lottie.GroupShapeElement).it),
          };
          break;
        case Lottie.ShapeType.Fill:
          parseFill(
            shape as Lottie.FillShape,
            attrs,
            keyframeAnimations,
            context
          );
          break;
        case Lottie.ShapeType.Stroke:
          parseStroke(
            shape as Lottie.StrokeShape,
            attrs,
            keyframeAnimations,
            context
          );
        case Lottie.ShapeType.Transform:
          parseTransforms(
            shape as Lottie.TransformShape,
            attrs,
            keyframeAnimations,
            context
          );
          break;
        default:
          ecEl = tryCreateShape(shape, keyframeAnimations);
      }
      if (ecEl) {
        ecEls.push(ecEl);
      }
    });

    ecEls.forEach((el) => {
      util.merge(el, attrs, true);
      el.keyframeAnimation = keyframeAnimations;
    });
    return ecEls;
  }

  const attrs: Record<string, any> = {};
  const keyframeAnimations: KeyframeAnimation[] = [];
  parseTransforms(layer.ks, attrs, keyframeAnimations, context);

  return {
    type: 'group',
    ...attrs,
    keyframeAnimation: keyframeAnimations,
    children: parseIterations(layer.shapes),
  };
}

export function parse(data: Lottie.Animation) {
  const context = new ParseContext();

  context.frameTime = 1000 / (data.fr || 30);
  context.startFrame = data.ip;
  context.endFrame = data.op;

  const elements: any[] = [];

  data.layers?.forEach((layer) => {
    switch (layer.ty) {
      case Lottie.LayerType.shape:
        elements.push(createShapes(layer as Lottie.ShapeLayer, context));
    }
  });

  return {
    width: data.w,
    height: data.h,
    elements,
  };
}

export { install };
