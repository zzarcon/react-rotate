import * as React from 'react';
import {Component} from 'react';
import {GHCorner} from 'react-gh-corner';
import {StylishInput} from 'react-stylish-input';
import AttachmentIcon from '@atlaskit/icon/glyph/attachment';
import Button from '@atlaskit/button';
import Rotate from '../src';
import {AppWrapper, ImageWrapper} from './styled';

export interface AppState {
  file?: File
}

const repoUrl = 'https://github.com/zzarcon/react-rotate';
export default class App extends Component <{}, AppState> {
  state: AppState = {
    
  }

  onChange = (e: any) => {
    const file = e.target.files[0];

    this.setState({file})
  }

  renderImage = () => {
    const {file} = this.state;
    if (!file) return;

    return (
      <Rotate file={file} />
    )
  }

  render() {
    return (
      <AppWrapper>
        <GHCorner openInNewTab href={repoUrl} />
        <StylishInput onChange={this.onChange}>
          <Button appearance="primary" iconAfter={<AttachmentIcon label="attachment" />}>
            Select file
          </Button>
        </StylishInput>
        <ImageWrapper>
          {this.renderImage()}
        </ImageWrapper>
      </AppWrapper>
    )
  }
}