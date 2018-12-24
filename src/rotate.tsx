import * as React from 'react';
import {Component} from 'react';
import FilePreview from 'react-preview-file';
import {getOrientation, getCssFromImageOrientation} from './util';

export interface RotateProps {
  file: File;
  className?: string;
}

export interface RotateState {
  orientation?: number;
  preview?: string;
}

export class Rotate extends Component<RotateProps, RotateState> {
  state: RotateState = {

  }

  async componentWillMount() {
    const {file} = this.props;
    const orientation = await getOrientation(file);

    this.setState({orientation});
  }

  // TODO: update state on prop changes

  render() {
    const {orientation} = this.state;
    const {className, file} = this.props;
    if (!orientation) return null;

    const style = {
      transform: getCssFromImageOrientation(orientation)
    };

    return (
      <FilePreview file={file}>
        {(preview) => <img src={preview} className={className} style={style} alt="preview" />}
      </FilePreview>
    );
  }
}