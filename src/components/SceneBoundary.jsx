import { Component } from 'react';

// Si el 3D falla (por ejemplo, el navegador no tiene WebGL), enseña un aviso y el resto del juego sigue funcionando.
export default class SceneBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { fallo: null };
  }

  static getDerivedStateFromError(error) {
    return { fallo: error };
  }

  componentDidCatch(error) {
    console.error('Error en la escena 3D', error);
  }

  render() {
    const { fallo } = this.state;
    const { fallback, children } = this.props;
    return fallo ? fallback : children;
  }
}
