import React from 'react';

import { shallow, mount } from 'enzyme';
import {expect} from 'chai';

import CodeCell from '../../../../src/notebook/components/cell/code-cell';
import * as commutable from 'commutable';
import { displayOrder, transforms } from 'transformime-react';

const sharedProps = { displayOrder, transforms };
describe('CodeCell', () => {
  it('can be rendered', () => {
    const cell = shallow(
      <CodeCell cell={commutable.emptyCodeCell} {...{ displayOrder, transforms }}/>
    );
    expect(cell).to.not.be.null;
  });
  it('creates an editor', () => {
    const cell = mount(
      <CodeCell cell={commutable.emptyCodeCell} {...{ displayOrder, transforms }}/>
    );
    expect(cell.find('.cell_editor').length).to.be.greaterThan(0);
  });
});
