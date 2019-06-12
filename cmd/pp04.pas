unit pp04;
interface
	function tan(x:real):real;
implementation
	function tan(x:real):real;
  begin
    tan := sin(x) / cos(x);
  end;
end.