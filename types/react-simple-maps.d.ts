declare module "react-simple-maps" {
  import { ReactNode, CSSProperties, MouseEvent } from "react";

  interface ComposableMapProps {
    projection?: string;
    projectionConfig?: Record<string, unknown>;
    width?: number;
    height?: number;
    style?: CSSProperties;
    className?: string;
    children?: ReactNode;
  }
  export function ComposableMap(props: ComposableMapProps): JSX.Element;

  interface ZoomableGroupProps {
    center?: [number, number];
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    children?: ReactNode;
  }
  export function ZoomableGroup(props: ZoomableGroupProps): JSX.Element;

  interface GeographiesProps {
    geography: string | object;
    children: (args: { geographies: Geography[] }) => ReactNode;
  }
  export function Geographies(props: GeographiesProps): JSX.Element;

  interface Geography {
    rsmKey: string;
    id: string | number;
    properties: Record<string, unknown>;
  }

  interface GeographyProps {
    geography: Geography;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    style?: { default?: CSSProperties; hover?: CSSProperties; pressed?: CSSProperties };
    onMouseEnter?: (event: MouseEvent) => void;
    onMouseLeave?: (event: MouseEvent) => void;
    onClick?: (event: MouseEvent) => void;
    className?: string;
  }
  export function Geography(props: GeographyProps): JSX.Element;

  interface MarkerProps {
    coordinates: [number, number];
    children?: ReactNode;
    style?: { default?: CSSProperties; hover?: CSSProperties; pressed?: CSSProperties };
  }
  export function Marker(props: MarkerProps): JSX.Element;
}
