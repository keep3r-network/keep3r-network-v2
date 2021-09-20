// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import '../../libraries/Keep3rLibrary.sol';

contract Keep3rLibraryForTest {
  function observe(address _pool, uint32[] memory _secondsAgo)
    external
    view
    returns (
      int56 _tickCumulative1,
      int56 _tickCumulative2,
      bool _success
    )
  {
    return Keep3rLibrary.observe(_pool, _secondsAgo);
  }
}
