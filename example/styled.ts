import styled, {injectGlobal} from 'styled-components';

injectGlobal`
  body {
    font-family: Helvetica;
    background-color: #D8D1F5;
  }

  * {
    box-sizing: content-box;
  }
`;

export const AppWrapper = styled.div`

`;

export const ImageWrapper = styled.div`
  width: 300px;
  height: 300px;
  overflow: hidden;
  
  img {
    width: 100%;
  }
`;