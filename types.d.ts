declare namespace S2 {
  function latLngToKey(lat: number, lng: number, level: number): string;

  namespace S2Cell {
    function FromLatLng(latLng: { lat: number; lng: number }, level: number): S2Cell;
  }

  interface S2Cell {
    getCornerLatLngs(): L.LatLngLiteral[];
  }
}
