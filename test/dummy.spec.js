
'use strict';
const chai = require('chai');
const should = chai.should(); // eslint-disable-line 
const expect = chai.expect; // eslint-disable-line 


const TEST_NAME = 'Test Example';

describe(TEST_NAME, () => {
	it('should Pass',() => {
		true.should.be.eql(true);
	});
});