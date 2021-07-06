var size = 0;

window.onload = function (){
  console.log('ok');

  $('.blok_4').on('click', function()
  {
    if (size == 0){
      $(this).css({'z-index': '4', 'width': '80%', 'right' : '5%', 'top' : '10%'});
      size = 1;
    }
    else{
      resetsize();
      size = 0;
    };
    console.log(this);
  });

}


function resetsize()
{
  size = 0;

  $('.links').css({'width': '42%', 'z-index': '1'});
  $('.midden').css({'width': '42%', 'z-index': '3', 'right' : '30%', 'top' : ''});
  $('.rechts').css({'width': '42%', 'z-index': '2', 'top' : '15%'});
}
