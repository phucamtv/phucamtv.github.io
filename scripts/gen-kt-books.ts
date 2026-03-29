import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

interface Book {
  title: string;
  titleEn: string;
  testament: "old" | "new";
  group: string;
  groupEn: string;
  short: string;
  long: string;
}

const books: Book[] = [
  // ===== CỰU ƯỚC =====
  // Năm Sách Của Môi-se / Pentateuch
  { title: "Sáng-thế Ký", titleEn: "Genesis", testament: "old", group: "Năm Sách Của Môi-se", groupEn: "Pentateuch",
    short: "Sách về sự sáng tạo, sa ngã, và giao ước của Đức Chúa Trời với các tổ phụ.",
    long: "Sách mở đầu Kinh Thánh, ghi lại sự sáng tạo trời đất, sự sa ngã của loài người, trận đại hồng thủy thời Nô-ê, sự lộn xộn tại tháp Ba-bên, và các giao ước của Đức Chúa Trời với Áp-ra-ham, Y-sác, Gia-cốp cùng mười hai chi phái Y-sơ-ra-ên. Sách kết thúc với câu chuyện Giô-sép tại Ai Cập và sự bảo tồn dòng dõi được chọn." },
  { title: "Xuất Ê-díp-tô Ký", titleEn: "Exodus", testament: "old", group: "Năm Sách Của Môi-se", groupEn: "Pentateuch",
    short: "Sách về sự giải phóng dân Y-sơ-ra-ên khỏi Ai Cập và giao ước tại Si-na-i.",
    long: "Sách thuật lại sự giải phóng dân Y-sơ-ra-ên khỏi ách nô lệ tại Ai Cập qua mười tai vạ, sự vượt qua Biển Đỏ, hành trình trong đồng vắng, việc ban Mười Điều Răn tại núi Si-na-i, và sự thiết lập Đền Tạm làm nơi Đức Chúa Trời ngự giữa dân Ngài." },
  { title: "Lê-vi Ký", titleEn: "Leviticus", testament: "old", group: "Năm Sách Của Môi-se", groupEn: "Pentateuch",
    short: "Sách về luật lệ tế lễ và sự thánh khiết của dân Đức Chúa Trời.",
    long: "Sách chứa các luật lệ về tế lễ, sự thanh sạch theo nghi thức, các ngày lễ thánh, và đời sống thánh khiết mà Đức Chúa Trời đòi hỏi nơi dân Y-sơ-ra-ên. Chủ đề trung tâm là sự thánh khiết của Đức Chúa Trời và con đường để loài người đến gần Ngài qua hệ thống tế lễ và thầy tế lễ dòng Lê-vi." },
  { title: "Dân-số Ký", titleEn: "Numbers", testament: "old", group: "Năm Sách Của Môi-se", groupEn: "Pentateuch",
    short: "Sách về cuộc hành trình của dân Y-sơ-ra-ên trong đồng vắng.",
    long: "Sách ghi lại cuộc kiểm tra dân số, bốn mươi năm lang thang trong đồng vắng vì sự bất tuân của thế hệ đầu tiên, những cuộc nổi loạn chống Môi-se, và sự chuẩn bị cho thế hệ mới bước vào đất hứa. Sách cho thấy cả sự kỷ luật lẫn lòng thành tín của Đức Chúa Trời đối với dân Ngài." },
  { title: "Phục-truyền Luật-lệ Ký", titleEn: "Deuteronomy", testament: "old", group: "Năm Sách Của Môi-se", groupEn: "Pentateuch",
    short: "Sách về những bài giảng cuối cùng của Môi-se trước khi vào đất hứa.",
    long: "Sách gồm những bài giảng cuối cùng của Môi-se cho thế hệ mới trước khi họ vào đất Ca-na-an. Môi-se nhắc lại luật pháp, kêu gọi sự vâng phục trọn vẹn, nhấn mạnh tình yêu của Đức Chúa Trời, các phước lành cho sự vâng lời và hình phạt cho sự bất tuân, rồi truyền quyền lãnh đạo cho Giô-suê." },

  // Các Sách Lịch Sử / Historical Books
  { title: "Giô-suê", titleEn: "Joshua", testament: "old", group: "Các Sách Lịch Sử", groupEn: "Historical Books",
    short: "Sách về cuộc chinh phục và phân chia đất Ca-na-an.",
    long: "Sách thuật lại cuộc chinh phục đất Ca-na-an dưới sự lãnh đạo của Giô-suê sau khi Môi-se qua đời. Các sự kiện chính gồm việc vượt sông Giô-đanh, trận chiến Giê-ri-cô, các cuộc chiến miền nam và miền bắc, sự phân chia đất cho mười hai chi phái, và lời kêu gọi cuối cùng của Giô-suê chọn phục vụ Đức Giê-hô-va." },
  { title: "Các Quan Xét", titleEn: "Judges", testament: "old", group: "Các Sách Lịch Sử", groupEn: "Historical Books",
    short: "Sách về thời kỳ các quan xét cai trị Y-sơ-ra-ên.",
    long: "Sách ghi lại thời kỳ hỗn loạn sau khi Giô-suê qua đời, khi dân Y-sơ-ra-ên lặp đi lặp lại vòng xoáy phạm tội, bị áp bức, kêu cầu Đức Chúa Trời, và được giải cứu qua các quan xét như Đê-bô-ra, Ghi-đê-ôn, và Sam-sôn. Câu chủ đề: 'Lúc đó không có vua trong Y-sơ-ra-ên; ai nấy làm theo ý mình lấy làm phải.'" },
  { title: "Ru-tơ", titleEn: "Ruth", testament: "old", group: "Các Sách Lịch Sử", groupEn: "Historical Books",
    short: "Câu chuyện về lòng trung thành và sự cứu chuộc của Ru-tơ.",
    long: "Câu chuyện cảm động về Ru-tơ, người đàn bà Mô-áp, trung thành theo mẹ chồng Na-ô-mi trở về Bết-lê-hem sau cái chết của chồng. Qua lòng trung tín và sự quan phòng của Đức Chúa Trời, Ru-tơ được Bô-ô chuộc lại làm vợ và trở thành bà cố của vua Đa-vít, nằm trong dòng dõi của Đấng Mê-si." },
  { title: "I Sa-mu-ên", titleEn: "1 Samuel", testament: "old", group: "Các Sách Lịch Sử", groupEn: "Historical Books",
    short: "Sách về Sa-mu-ên, Sau-lơ và sự lên ngôi của Đa-vít.",
    long: "Sách thuật lại sự chuyển tiếp từ thời các quan xét sang thời quân chủ. Gồm câu chuyện tiên tri Sa-mu-ên được sinh ra và kêu gọi, việc dân Y-sơ-ra-ên đòi lập vua, triều đại thất bại của Sau-lơ, sự xức dầu cho Đa-vít, và cuộc xung đột kéo dài giữa Sau-lơ ghen ghét và Đa-vít được Đức Chúa Trời chọn." },
  { title: "II Sa-mu-ên", titleEn: "2 Samuel", testament: "old", group: "Các Sách Lịch Sử", groupEn: "Historical Books",
    short: "Sách về triều đại của vua Đa-vít.",
    long: "Sách ghi lại triều đại bốn mươi năm của vua Đa-vít, từ lúc lên ngôi tại Hếp-rôn đến khi cai trị toàn Y-sơ-ra-ên tại Giê-ru-sa-lem. Gồm giao ước đời đời của Đức Chúa Trời với Đa-vít, tội lỗi với Bát-Sê-ba, hậu quả trong gia đình, cuộc nổi loạn của Áp-sa-lôm, và những chiến thắng lẫn thất bại của một vua hợp lòng Đức Chúa Trời." },
  { title: "I Các Vua", titleEn: "1 Kings", testament: "old", group: "Các Sách Lịch Sử", groupEn: "Historical Books",
    short: "Sách về Sa-lô-môn và sự phân chia vương quốc.",
    long: "Sách bắt đầu với triều đại vinh quang của Sa-lô-môn, việc xây đền thờ Giê-ru-sa-lem, sự khôn ngoan và giàu có chưa từng có, rồi sự sa ngã vì các vợ ngoại bang. Sau khi Sa-lô-môn qua đời, vương quốc bị chia đôi thành Y-sơ-ra-ên (phía bắc) và Giu-đa (phía nam). Sách cũng ghi lại chức vụ tiên tri Ê-li đối đầu với vua A-háp và nữ hoàng Giê-sa-bên." },
  { title: "II Các Vua", titleEn: "2 Kings", testament: "old", group: "Các Sách Lịch Sử", groupEn: "Historical Books",
    short: "Sách về sự suy vong của hai vương quốc Y-sơ-ra-ên và Giu-đa.",
    long: "Sách tiếp tục lịch sử hai vương quốc song song. Tiên tri Ê-li-sê nối tiếp Ê-li, thực hiện nhiều phép lạ. Vương quốc phía bắc Y-sơ-ra-ên sụp đổ trước A-si-ri năm 722 TC. Vương quốc Giu-đa trải qua vài cuộc cải cách dưới Ê-xê-chia và Giô-si-a, nhưng cuối cùng bị Ba-by-lôn hủy diệt năm 586 TC, đền thờ bị phá, dân bị lưu đày." },
  { title: "I Sử-ký", titleEn: "1 Chronicles", testament: "old", group: "Các Sách Lịch Sử", groupEn: "Historical Books",
    short: "Sách gia phả và lịch sử từ A-đam đến Đa-vít.",
    long: "Sách bắt đầu với các gia phả từ A-đam đến mười hai chi phái Y-sơ-ra-ên, sau đó tập trung vào triều đại Đa-vít từ góc độ thờ phượng và thuộc linh. Đặc biệt nhấn mạnh việc Đa-vít chuẩn bị vật liệu và tổ chức các ban hát, ban nhạc, và ban thầy tế lễ cho đền thờ mà Sa-lô-môn sẽ xây." },
  { title: "II Sử-ký", titleEn: "2 Chronicles", testament: "old", group: "Các Sách Lịch Sử", groupEn: "Historical Books",
    short: "Sách về lịch sử các vua Giu-đa từ Sa-lô-môn đến lưu đày.",
    long: "Sách ghi lại lịch sử vương quốc Giu-đa từ triều đại Sa-lô-môn với việc xây và cung hiến đền thờ, qua các đời vua trung tín và bất trung, các cuộc cải cách tôn giáo, cho đến khi Giê-ru-sa-lem thất thủ và dân bị lưu đày sang Ba-by-lôn. Sách kết thúc với chiếu chỉ của Si-ru cho phép dân trở về." },
  { title: "E-xơ-ra", titleEn: "Ezra", testament: "old", group: "Các Sách Lịch Sử", groupEn: "Historical Books",
    short: "Sách về sự hồi hương và tái thiết đền thờ.",
    long: "Sách thuật lại hai đợt hồi hương từ Ba-by-lôn. Đợt thứ nhất dưới Xô-rô-ba-bên xây lại đền thờ dù gặp nhiều chống đối. Đợt thứ hai dưới thầy tế lễ E-xơ-ra tập trung vào sự cải cách thuộc linh, dạy dỗ Luật pháp, và xử lý vấn đề hôn nhân với người ngoại bang để giữ gìn sự tinh sạch của dân giao ước." },
  { title: "Nê-hê-mi", titleEn: "Nehemiah", testament: "old", group: "Các Sách Lịch Sử", groupEn: "Historical Books",
    short: "Sách về việc xây lại tường thành Giê-ru-sa-lem.",
    long: "Sách ghi lại sứ mạng của Nê-hê-mi, quan tửu chánh của vua Ba-tư, trở về Giê-ru-sa-lem xây lại tường thành trong năm mươi hai ngày dù bị kẻ thù chống phá dữ dội. Sau đó, cùng với E-xơ-ra, Nê-hê-mi lãnh đạo cuộc cải cách thuộc linh, đọc Luật pháp cho dân, và lập lại giao ước với Đức Chúa Trời." },
  { title: "Ê-xơ-tê", titleEn: "Esther", testament: "old", group: "Các Sách Lịch Sử", groupEn: "Historical Books",
    short: "Câu chuyện về hoàng hậu Ê-xơ-tê giải cứu dân Do Thái.",
    long: "Câu chuyện về hoàng hậu Ê-xơ-tê, người Do Thái sống tại Ba-tư, đã liều mạng sống để ngăn chặn âm mưu diệt chủng của Ha-man. Dù tên Đức Chúa Trời không được nhắc trực tiếp trong sách, sự quan phòng của Ngài rõ ràng qua từng sự kiện, dẫn đến sự giải cứu toàn dân Do Thái và sự thiết lập lễ Phu-rim." },

  // Các Sách Thơ-Văn / Poetry & Wisdom
  { title: "Gióp", titleEn: "Job", testament: "old", group: "Các Sách Thơ-Văn", groupEn: "Poetry & Wisdom",
    short: "Sách về sự đau khổ và đức tin của Gióp.",
    long: "Sách đặt ra câu hỏi sâu sắc về sự đau khổ của người công bình. Gióp, một người trọn vẹn và ngay thẳng, mất hết tài sản, con cái, và sức khỏe. Ba người bạn đến tranh luận rằng Gióp phải có tội, nhưng Gióp giữ vững sự vô tội của mình. Cuối cùng Đức Chúa Trời phán từ cơn gió lốc, bày tỏ quyền tối thượng của Ngài, và phục hồi Gióp gấp đôi." },
  { title: "Thi-thiên", titleEn: "Psalms", testament: "old", group: "Các Sách Thơ-Văn", groupEn: "Poetry & Wisdom",
    short: "Tuyển tập 150 bài thi thiên ca ngợi và cầu nguyện.",
    long: "Tuyển tập 150 bài thơ và bài hát dùng trong sự thờ phượng của dân Y-sơ-ra-ên, phần lớn do Đa-vít sáng tác. Các chủ đề bao gồm ca ngợi, cầu nguyện, ăn năn, than thở, tin cậy, và tiên tri về Đấng Mê-si. Thi-thiên bày tỏ mọi cung bậc cảm xúc của con người trước mặt Đức Chúa Trời và là sách được trích dẫn nhiều nhất trong Tân Ước." },
  { title: "Châm-ngôn", titleEn: "Proverbs", testament: "old", group: "Các Sách Thơ-Văn", groupEn: "Poetry & Wisdom",
    short: "Sách về sự khôn ngoan thực tiễn cho đời sống.",
    long: "Sách tập hợp những câu châm ngôn khôn ngoan, phần lớn do Sa-lô-môn viết, hướng dẫn thực tiễn cho đời sống hằng ngày. Các chủ đề gồm sự kính sợ Đức Giê-hô-va là khởi đầu sự khôn ngoan, quan hệ gia đình, tài chính, lời nói, sự lười biếng, tình bạn, và sự công bình. Sách nhân cách hóa sự khôn ngoan như một phụ nữ kêu gọi mọi người." },
  { title: "Truyền-đạo", titleEn: "Ecclesiastes", testament: "old", group: "Các Sách Thơ-Văn", groupEn: "Poetry & Wisdom",
    short: "Sách suy gẫm về ý nghĩa cuộc đời.",
    long: "Sách suy gẫm triết lý của người truyền đạo (có thể là Sa-lô-môn) về ý nghĩa cuộc đời. Sau khi tìm kiếm ý nghĩa qua khôn ngoan, khoái lạc, giàu có, và công việc, tác giả kết luận rằng mọi sự dưới mặt trời đều là hư không nếu không có Đức Chúa Trời. Lời kết: 'Hãy kính sợ Đức Chúa Trời và giữ các điều răn Ngài.'" },
  { title: "Nhã-ca", titleEn: "Song of Solomon", testament: "old", group: "Các Sách Thơ-Văn", groupEn: "Poetry & Wisdom",
    short: "Bài ca về tình yêu giữa chàng rể và cô dâu.",
    long: "Bài thơ tình yêu giữa chàng rể và cô dâu, được truyền thống hiểu là hình bóng về tình yêu giữa Đức Chúa Trời với dân Y-sơ-ra-ên, và giữa Đấng Christ với Hội Thánh. Sách ca ngợi vẻ đẹp, sự khao khát, và lòng chung thủy trong tình yêu, khẳng định rằng tình yêu mạnh như sự chết và lửa nước không dập tắt được." },

  // Các Sách Tiên-Tri / Prophetic Books
  { title: "Ê-sai", titleEn: "Isaiah", testament: "old", group: "Các Sách Tiên-Tri", groupEn: "Prophetic Books",
    short: "Sách tiên tri về sự phán xét và hy vọng cứu chuộc.",
    long: "Sách tiên tri lớn nhất trong Cựu Ước với 66 chương, chia thành hai phần chính. Phần đầu (1-39) cảnh báo sự phán xét trên Giu-đa và các dân tộc vì tội lỗi. Phần sau (40-66) mang sứ điệp an ủi, hy vọng, và cứu chuộc qua Đầy Tớ chịu khổ của Đức Giê-hô-va. Chương 53 là lời tiên tri chi tiết nhất về sự chết thay của Đấng Mê-si." },
  { title: "Giê-rê-mi", titleEn: "Jeremiah", testament: "old", group: "Các Sách Tiên-Tri", groupEn: "Prophetic Books",
    short: "Sách tiên tri về sự sụp đổ của Giu-đa và giao ước mới.",
    long: "Sách của nhà tiên tri khóc than, được kêu gọi từ khi còn trẻ để rao giảng sự phán xét sắp đến trên Giu-đa qua tay Ba-by-lôn. Dù bị bắt bớ, tù đày, và chống đối bởi vua quan và dân chúng, Giê-rê-mi trung tín rao truyền sứ điệp ăn năn. Sách cũng chứa lời hứa về giao ước mới mà Đức Chúa Trời sẽ ghi vào lòng dân Ngài." },
  { title: "Ca-thương", titleEn: "Lamentations", testament: "old", group: "Các Sách Tiên-Tri", groupEn: "Prophetic Books",
    short: "Những bài ai ca về sự sụp đổ của Giê-ru-sa-lem.",
    long: "Năm bài ai ca do Giê-rê-mi sáng tác, than khóc sự sụp đổ của Giê-ru-sa-lem và đền thờ bị Ba-by-lôn phá hủy năm 586 TC. Mỗi chương là một bài thơ theo thể acrostic (chữ cái tiếng Hê-bơ-rơ). Giữa nỗi đau tận cùng, chương 3 bày tỏ hy vọng: 'Sự thương xót của Đức Giê-hô-va không dứt, mỗi buổi sáng thì lại mới.'" },
  { title: "Ê-xê-chi-ên", titleEn: "Ezekiel", testament: "old", group: "Các Sách Tiên-Tri", groupEn: "Prophetic Books",
    short: "Sách tiên tri về sự phán xét và phục hồi của Y-sơ-ra-ên.",
    long: "Sách tiên tri viết trong thời lưu đày tại Ba-by-lôn, đầy những khải tượng kỳ diệu. Phần đầu cảnh báo sự phán xét trên Giê-ru-sa-lem và các dân tộc. Phần sau hứa sự phục hồi Y-sơ-ra-ên qua khải tượng trũng xương khô sống lại, sự ban Thánh Linh mới, và đền thờ tương lai. Chủ đề chính: các dân sẽ biết Đức Giê-hô-va là Chúa." },
  { title: "Đa-ni-ên", titleEn: "Daniel", testament: "old", group: "Các Sách Tiên-Tri", groupEn: "Prophetic Books",
    short: "Sách về đức tin trong lưu đày và các khải tượng về tương lai.",
    long: "Sách gồm hai phần: phần tường thuật (1-6) về đức tin kiên cường của Đa-ni-ên và ba bạn trong triều đình Ba-by-lôn và Ba-tư, gồm lò lửa hực, hang sư tử, và việc giải mộng cho vua. Phần khải tượng (7-12) chứa những lời tiên tri về các đế quốc thế giới, bảy mươi tuần lễ, và các sự kiện ngày sau rốt." },
  { title: "Ô-sê", titleEn: "Hosea", testament: "old", group: "Các Sách Tiên-Tri", groupEn: "Prophetic Books",
    short: "Sách tiên tri về tình yêu thành tín của Đức Chúa Trời.",
    long: "Sách tiên tri đặc biệt trong đó Đức Chúa Trời bảo Ô-sê cưới một người vợ không chung thủy tên Gô-me làm hình bóng cho mối quan hệ giữa Đức Chúa Trời và dân Y-sơ-ra-ên bất trung. Dù bị phản bội, Ô-sê chuộc vợ trở về, minh họa tình yêu kiên trì và lòng thương xót không lay chuyển của Đức Chúa Trời dành cho dân Ngài." },
  { title: "Giô-ên", titleEn: "Joel", testament: "old", group: "Các Sách Tiên-Tri", groupEn: "Prophetic Books",
    short: "Sách tiên tri về ngày của Đức Giê-hô-va và sự đổ Thánh Linh.",
    long: "Sách tiên tri lấy cơn đại dịch châu chấu tàn phá xứ Giu-đa làm bối cảnh để cảnh báo về ngày lớn và đáng sợ của Đức Giê-hô-va sắp đến. Giô-ên kêu gọi toàn dân ăn năn, kiêng ăn, và quay lại cùng Đức Chúa Trời. Sách chứa lời hứa nổi tiếng về việc Đức Chúa Trời sẽ đổ Thần Ngài trên mọi loài xác thịt, được ứng nghiệm trong ngày lễ Ngũ Tuần." },
  { title: "A-mốt", titleEn: "Amos", testament: "old", group: "Các Sách Tiên-Tri", groupEn: "Prophetic Books",
    short: "Sách tiên tri về công lý xã hội và sự phán xét các dân tộc.",
    long: "Sách tiên tri của một người chăn chiên từ Thê-cô-a được kêu gọi rao giảng cho vương quốc phía bắc Y-sơ-ra-ên trong thời kỳ thịnh vượng vật chất nhưng suy đồi đạo đức. A-mốt lên án sự bất công xã hội, áp bức người nghèo, sự thờ phượng giả hình, và kêu gọi sự công bình chảy như nước và sự công chính như dòng sông không bao giờ cạn." },
  { title: "Áp-đia", titleEn: "Obadiah", testament: "old", group: "Các Sách Tiên-Tri", groupEn: "Prophetic Books",
    short: "Sách tiên tri ngắn nhất về sự phán xét Ê-đôm.",
    long: "Sách tiên tri ngắn nhất trong Cựu Ước với chỉ 21 câu, tuyên bố sự phán xét của Đức Chúa Trời trên dân Ê-đôm (con cháu Ê-sau) vì kiêu ngạo, bạo lực, và sự phản bội anh em Y-sơ-ra-ên khi Giê-ru-sa-lem bị tấn công. Sách kết thúc với lời hứa về sự phục hồi và vương quốc cuối cùng thuộc về Đức Giê-hô-va." },
  { title: "Giô-na", titleEn: "Jonah", testament: "old", group: "Các Sách Tiên-Tri", groupEn: "Prophetic Books",
    short: "Câu chuyện về nhà tiên tri Giô-na và lòng thương xót của Đức Chúa Trời.",
    long: "Câu chuyện về nhà tiên tri Giô-na chạy trốn sứ mạng rao giảng cho Ni-ni-ve, thủ đô A-si-ri, kẻ thù của Y-sơ-ra-ên. Sau ba ngày trong bụng cá lớn, Giô-na vâng lời đi rao giảng và cả thành ăn năn. Nhưng Giô-na tức giận vì Đức Chúa Trời tha thứ cho họ, bày tỏ lòng thương xót của Đức Chúa Trời vượt qua biên giới dân tộc." },
  { title: "Mi-chê", titleEn: "Micah", testament: "old", group: "Các Sách Tiên-Tri", groupEn: "Prophetic Books",
    short: "Sách tiên tri về công lý, sự thương xót và sự khiêm nhường.",
    long: "Sách tiên tri cùng thời với Ê-sai, lên án sự bất công, tham nhũng của giới lãnh đạo, và sự thờ hình tượng tại cả Sa-ma-ri lẫn Giê-ru-sa-lem. Mi-chê tiên tri Đấng Mê-si sẽ sinh tại Bết-lê-hem và tóm tắt điều Đức Chúa Trời đòi hỏi: 'Làm sự công bình, ưa sự nhân từ, và bước đi cách khiêm nhường với Đức Chúa Trời ngươi.'" },
  { title: "Na-hum", titleEn: "Nahum", testament: "old", group: "Các Sách Tiên-Tri", groupEn: "Prophetic Books",
    short: "Sách tiên tri về sự sụp đổ của Ni-ni-ve.",
    long: "Sách tiên tri tuyên bố sự phán xét và sụp đổ hoàn toàn của Ni-ni-ve, thủ đô đế quốc A-si-ri tàn bạo. Khoảng 150 năm sau khi thành này ăn năn dưới lời rao giảng của Giô-na, Ni-ni-ve đã quay lại con đường hung bạo. Na-hum khẳng định Đức Chúa Trời chậm giận nhưng lớn quyền và sẽ không kể kẻ có tội là vô tội." },
  { title: "Ha-ba-cúc", titleEn: "Habakkuk", testament: "old", group: "Các Sách Tiên-Tri", groupEn: "Prophetic Books",
    short: "Sách tiên tri về đức tin giữa sự bất công.",
    long: "Sách tiên tri độc đáo theo hình thức đối thoại giữa nhà tiên tri và Đức Chúa Trời. Ha-ba-cúc hỏi tại sao Đức Chúa Trời cho phép sự bất công trong Giu-đa, rồi sửng sốt khi biết Ngài sẽ dùng Ba-by-lôn gian ác hơn để phán xét. Qua đó, Ha-ba-cúc học biết rằng 'người công bình sẽ sống bởi đức tin' và kết thúc bằng bài ca tin cậy tuyệt vời." },
  { title: "Sô-phô-ni", titleEn: "Zephaniah", testament: "old", group: "Các Sách Tiên-Tri", groupEn: "Prophetic Books",
    short: "Sách tiên tri về ngày phán xét lớn và sự phục hồi.",
    long: "Sách tiên tri cảnh báo về ngày lớn và kinh khiếp của Đức Giê-hô-va sẽ giáng trên Giu-đa và mọi dân tộc vì sự thờ hình tượng, kiêu ngạo, và bất công. Sô-phô-ni kêu gọi sự ăn năn và tìm kiếm Đức Chúa Trời. Sách kết thúc bằng lời hứa đầy hy vọng rằng Đức Chúa Trời sẽ vui mừng vì dân Ngài và phục hồi họ." },
  { title: "A-ghê", titleEn: "Haggai", testament: "old", group: "Các Sách Tiên-Tri", groupEn: "Prophetic Books",
    short: "Sách tiên tri kêu gọi xây lại đền thờ.",
    long: "Sách tiên tri ngắn gồm bốn sứ điệp khích lệ dân hồi hương hoàn thành việc xây lại đền thờ đã bị bỏ dở mười sáu năm vì sự chống đối và thờ ơ. A-ghê quở trách dân vì lo xây nhà riêng trong khi nhà Đức Chúa Trời hoang phế, và hứa sự vinh hiển của đền thờ mới sẽ lớn hơn đền thờ cũ." },
  { title: "Xa-cha-ri", titleEn: "Zechariah", testament: "old", group: "Các Sách Tiên-Tri", groupEn: "Prophetic Books",
    short: "Sách tiên tri về các khải tượng và Đấng Mê-si sẽ đến.",
    long: "Sách tiên tri cùng thời với A-ghê, chứa tám khải tượng ban đêm đầy hình ảnh tượng trưng về sự phục hồi Giê-ru-sa-lem và đền thờ. Phần sau chứa những lời tiên tri Mê-si quan trọng: Vua cưỡi lừa vào Giê-ru-sa-lem, ba mươi miếng bạc, bị đâm, và Mục Tử bị đánh. Xa-cha-ri là sách Cựu Ước được Tân Ước trích dẫn nhiều nhất về Đấng Christ." },
  { title: "Ma-la-chi", titleEn: "Malachi", testament: "old", group: "Các Sách Tiên-Tri", groupEn: "Prophetic Books",
    short: "Sách tiên tri cuối cùng của Cựu Ước về sự trung tín với Đức Chúa Trời.",
    long: "Sách tiên tri cuối cùng của Cựu Ước, viết sau khi dân hồi hương nhưng lòng đã nguội lạnh. Ma-la-chi quở trách các thầy tế lễ dâng của lễ kém phẩm chất, dân chúng giữ lại phần mười, và sự bất trung trong hôn nhân. Sách kết thúc với lời hứa Đức Chúa Trời sẽ sai Ê-li đến trước ngày lớn của Ngài, mở đường cho bốn trăm năm im lặng trước khi Đấng Mê-si đến." },

  // ===== TÂN ƯỚC =====
  // Các Sách Tin Lành / Gospels
  { title: "Ma-thi-ơ", titleEn: "Matthew", testament: "new", group: "Các Sách Tin Lành", groupEn: "Gospels",
    short: "Tin Lành về Chúa Giê-su là Vua của dân Do Thái.",
    long: "Tin Lành viết cho người Do Thái, trình bày Chúa Giê-su là Vua và Đấng Mê-si được hứa trong Cựu Ước. Sách mở đầu với gia phả từ Áp-ra-ham, chứa năm bài giảng lớn gồm Bài Giảng Trên Núi, nhiều dụ ngôn về Nước Trời, và kết thúc với Đại Mạng Lệnh sai môn đồ đi khắp muôn dân." },
  { title: "Mác", titleEn: "Mark", testament: "new", group: "Các Sách Tin Lành", groupEn: "Gospels",
    short: "Tin Lành ngắn gọn về Chúa Giê-su là Đầy Tớ của Đức Chúa Trời.",
    long: "Tin Lành ngắn nhất và nhanh nhất, viết cho độc giả La Mã, trình bày Chúa Giê-su là Đầy Tớ hành động của Đức Chúa Trời. Từ 'tức thì' xuất hiện hơn bốn mươi lần, nhấn mạnh những việc làm quyền năng, phép lạ, và sự phục vụ không ngừng của Chúa. Gần một phần ba sách dành cho tuần lễ cuối cùng tại Giê-ru-sa-lem." },
  { title: "Lu-ca", titleEn: "Luke", testament: "new", group: "Các Sách Tin Lành", groupEn: "Gospels",
    short: "Tin Lành về Chúa Giê-su là Con Người cứu rỗi mọi người.",
    long: "Tin Lành chi tiết nhất, viết bởi bác sĩ Lu-ca cho quan Thê-ô-phi-lơ, trình bày Chúa Giê-su là Con Người đến tìm và cứu kẻ bị mất. Sách đặc biệt quan tâm đến người nghèo, người bị gạt ra ngoài lề, phụ nữ, và người ngoại. Chứa nhiều dụ ngôn độc đáo như người Sa-ma-ri nhân lành, đứa con trai hoang đàng, và người thu thuế trong đền thờ." },
  { title: "Giăng", titleEn: "John", testament: "new", group: "Các Sách Tin Lành", groupEn: "Gospels",
    short: "Tin Lành về Chúa Giê-su là Con Đức Chúa Trời.",
    long: "Tin Lành thần học sâu sắc nhất, trình bày Chúa Giê-su là Ngôi Lời trở nên xác thịt, Con Đức Chúa Trời ban sự sống đời đời cho kẻ tin. Sách xoay quanh bảy dấu lạ và bảy lời tuyên bố 'Ta là' của Chúa Giê-su. Mục đích được nêu rõ: 'Hầu cho các ngươi tin rằng Đức Chúa Giê-su là Đấng Christ, Con Đức Chúa Trời, và nhờ tin mà được sự sống.'" },

  // Lịch Sử / History
  { title: "Công-vụ các Sứ-đồ", titleEn: "Acts", testament: "new", group: "Lịch Sử", groupEn: "History",
    short: "Sách về sự hình thành và phát triển của Hội Thánh đầu tiên.",
    long: "Sách lịch sử của Hội Thánh đầu tiên, tiếp nối Tin Lành Lu-ca. Bắt đầu với sự thăng thiên của Chúa Giê-su và ngày lễ Ngũ Tuần khi Đức Thánh Linh giáng lâm, Hội Thánh ra đời và lan rộng từ Giê-ru-sa-lem đến tận cùng trái đất. Nửa đầu tập trung vào Phi-e-rơ và Hội Thánh gốc Do Thái; nửa sau theo ba chuyến truyền giáo của Phao-lô đến thế giới dân ngoại." },

  // Các Thư Phao-lô / Pauline Epistles
  { title: "Rô-ma", titleEn: "Romans", testament: "new", group: "Các Thư Phao-lô", groupEn: "Pauline Epistles",
    short: "Thư về sự xưng công bình bởi đức tin.",
    long: "Thư thần học có hệ thống nhất của Phao-lô, trình bày Tin Lành một cách toàn diện. Mọi người đều phạm tội và thiếu mất sự vinh hiển của Đức Chúa Trời, nhưng được xưng công bình nhưng không bởi ân điển qua đức tin nơi Đấng Christ. Sách bàn về sự thánh hóa, vai trò của Thánh Linh, kế hoạch của Đức Chúa Trời cho Y-sơ-ra-ên, và đời sống đạo đức thực tiễn." },
  { title: "I Cô-rinh-tô", titleEn: "1 Corinthians", testament: "new", group: "Các Thư Phao-lô", groupEn: "Pauline Epistles",
    short: "Thư giải quyết các vấn đề trong Hội Thánh Cô-rinh-tô.",
    long: "Thư giải quyết nhiều vấn đề thực tiễn trong Hội Thánh Cô-rinh-tô: chia rẽ bè đảng, vô luân, kiện tụng, hôn nhân, thức ăn cúng thần tượng, trật tự thờ phượng, các ân tứ Thánh Linh, và sự sống lại. Chương 13 về tình yêu thương và chương 15 về sự phục sinh là những đoạn được biết đến nhiều nhất." },
  { title: "II Cô-rinh-tô", titleEn: "2 Corinthians", testament: "new", group: "Các Thư Phao-lô", groupEn: "Pauline Epistles",
    short: "Thư về chức vụ sứ đồ và sự an ủi trong hoạn nạn.",
    long: "Thư cá nhân nhất của Phao-lô, bày tỏ tấm lòng mục vụ và bảo vệ chức vụ sứ đồ trước những kẻ chống đối. Phao-lô chia sẻ về sự an ủi trong hoạn nạn, vinh hiển của giao ước mới, bảo vật chứa trong bình đất, sự giàu có qua sự nghèo khó, niềm vui trong sự dâng hiến, và sức mạnh trong sự yếu đuối: 'Ân điển ta đủ cho ngươi.'" },
  { title: "Ga-la-ti", titleEn: "Galatians", testament: "new", group: "Các Thư Phao-lô", groupEn: "Pauline Epistles",
    short: "Thư về sự tự do trong Đấng Christ khỏi luật pháp.",
    long: "Thư bảo vệ mạnh mẽ Tin Lành về ân điển chống lại những kẻ dạy phải giữ luật pháp Môi-se để được cứu. Phao-lô khẳng định sự xưng công bình chỉ bởi đức tin, không bởi việc làm của luật pháp. Sách tuyên bố sự tự do trong Đấng Christ, bông trái của Thánh Linh, và nguyên tắc gieo gì gặt nấy." },
  { title: "Ê-phê-sô", titleEn: "Ephesians", testament: "new", group: "Các Thư Phao-lô", groupEn: "Pauline Epistles",
    short: "Thư về Hội Thánh là thân thể của Đấng Christ.",
    long: "Thư trình bày kế hoạch đời đời của Đức Chúa Trời cho Hội Thánh. Phần đầu (1-3) bày tỏ các phước hạnh thuộc linh trong Đấng Christ, sự cứu rỗi bởi ân điển qua đức tin, và sự hiệp nhất người Do Thái và dân ngoại thành một thân thể. Phần sau (4-6) hướng dẫn đời sống xứng đáng với ơn kêu gọi, các mối quan hệ, và khí giới thuộc linh để đứng vững." },
  { title: "Phi-líp", titleEn: "Philippians", testament: "new", group: "Các Thư Phao-lô", groupEn: "Pauline Epistles",
    short: "Thư về niềm vui và sự khiêm nhường trong Đấng Christ.",
    long: "Thư của niềm vui viết từ trong tù, gửi cho Hội Thánh thân yêu nhất của Phao-lô. Dù đang bị xiềng xích, Phao-lô bày tỏ niềm vui không tùy thuộc hoàn cảnh. Chương 2 chứa bài ca tuyệt vời về sự khiêm nhường của Đấng Christ từ bỏ vinh hiển thiên đàng. Phao-lô khuyên: 'Hãy vui mừng trong Chúa luôn luôn.'" },
  { title: "Cô-lô-se", titleEn: "Colossians", testament: "new", group: "Các Thư Phao-lô", groupEn: "Pauline Epistles",
    short: "Thư về sự tối cao của Đấng Christ trên mọi sự.",
    long: "Thư chống lại tà giáo tại Cô-lô-se bằng cách tôn cao sự tối cao tuyệt đối của Đấng Christ. Ngài là hình ảnh của Đức Chúa Trời không thấy được, đầu của Hội Thánh, và trong Ngài cả sự đầy dẫy của bản thể Đức Chúa Trời hiện diện. Vì vậy tín hữu không cần thêm triết học, nghi lễ, hay thiên sứ nào khác ngoài Đấng Christ đủ cả." },
  { title: "I Tê-sa-lô-ni-ca", titleEn: "1 Thessalonians", testament: "new", group: "Các Thư Phao-lô", groupEn: "Pauline Epistles",
    short: "Thư về sự tái lâm của Chúa và đời sống thánh khiết.",
    long: "Thư sớm nhất của Phao-lô, viết cho Hội Thánh non trẻ đang chịu bắt bớ. Phao-lô khen ngợi đức tin, tình yêu, và sự trông cậy của họ, khuyến khích sống thánh khiết, và giải đáp thắc mắc về số phận của tín hữu đã qua đời trước khi Chúa tái lâm. Sách chứa lời mô tả chi tiết về sự cất lên của Hội Thánh khi Chúa trở lại." },
  { title: "II Tê-sa-lô-ni-ca", titleEn: "2 Thessalonians", testament: "new", group: "Các Thư Phao-lô", groupEn: "Pauline Epistles",
    short: "Thư về ngày của Chúa và sự kiên nhẫn trong đức tin.",
    long: "Thư tiếp theo sửa chữa sự hiểu lầm rằng ngày của Chúa đã đến. Phao-lô giải thích rằng trước khi Chúa tái lâm, sẽ có sự bội đạo lớn và người tội ác phải xuất hiện. Trong khi chờ đợi, tín hữu phải kiên nhẫn trong hoạn nạn, đứng vững trong lẽ thật, và siêng năng làm việc thay vì sống lười biếng." },
  { title: "I Ti-mô-thê", titleEn: "1 Timothy", testament: "new", group: "Các Thư Phao-lô", groupEn: "Pauline Epistles",
    short: "Thư hướng dẫn Ti-mô-thê về tổ chức Hội Thánh.",
    long: "Thư mục vụ của Phao-lô gửi cho Ti-mô-thê, người con thuộc linh đang quản lý Hội Thánh tại Ê-phê-sô. Hướng dẫn về cách chống tà giáo, tổ chức sự thờ phượng, tiêu chuẩn cho giám mục và chấp sự, cách đối xử với các nhóm trong Hội Thánh, và lời khuyên cá nhân. Câu chủ đề: Hội Thánh là trụ và nền của lẽ thật." },
  { title: "II Ti-mô-thê", titleEn: "2 Timothy", testament: "new", group: "Các Thư Phao-lô", groupEn: "Pauline Epistles",
    short: "Thư cuối cùng của Phao-lô về sự trung tín trong chức vụ.",
    long: "Thư cuối cùng của Phao-lô, viết từ ngục tù La Mã khi biết sắp tử đạo. Đây là di chúc thuộc linh gửi Ti-mô-thê, kêu gọi sự can đảm, trung tín giữ gìn Tin Lành, chịu khổ như người lính giỏi, và giảng đạo mùa thuận tiện hay không. Phao-lô tuyên bố: 'Ta đã đánh trận tốt lành, đã xong sự chạy, đã giữ được đức tin.'" },
  { title: "Tít", titleEn: "Titus", testament: "new", group: "Các Thư Phao-lô", groupEn: "Pauline Epistles",
    short: "Thư về tổ chức Hội Thánh tại đảo Cơ-rết.",
    long: "Thư mục vụ gửi cho Tít đang tổ chức các Hội Thánh trên đảo Cơ-rết. Phao-lô hướng dẫn về tiêu chuẩn cho trưởng lão, dạy dỗ phù hợp cho từng nhóm tuổi, và nền tảng thần học của đời sống tin kính: ân điển Đức Chúa Trời đã hiện ra cứu mọi người, dạy chúng ta sống tiết độ, công bình, và nhân đức trong đời này." },
  { title: "Phi-lê-môn", titleEn: "Philemon", testament: "new", group: "Các Thư Phao-lô", groupEn: "Pauline Epistles",
    short: "Thư ngắn về sự tha thứ và tình anh em trong Đấng Christ.",
    long: "Thư ngắn nhất và cá nhân nhất của Phao-lô, gửi cho Phi-lê-môn xin nhận lại Ô-nê-sim, nô lệ đã bỏ trốn nay đã tin Chúa. Phao-lô xin Phi-lê-môn đón Ô-nê-sim không như nô lệ mà như anh em yêu dấu trong Chúa. Thư là minh họa sống động về sự tha thứ, hòa giải, và bình đẳng trong Đấng Christ vượt qua mọi giai cấp xã hội." },

  // Các Thư Tổng Quát / General Epistles
  { title: "Hê-bơ-rơ", titleEn: "Hebrews", testament: "new", group: "Các Thư Tổng Quát", groupEn: "General Epistles",
    short: "Thư về sự tối cao của Đấng Christ và giao ước mới.",
    long: "Thư trình bày sự tối cao của Đấng Christ trên mọi sự trong hệ thống Cựu Ước: cao hơn thiên sứ, Môi-se, Giô-suê, và chức tế lễ theo dòng A-rôn. Đấng Christ là Thầy Tế Lễ Thượng Phẩm đời đời theo dòng Mên-chi-xê-đéc, Đấng Trung Bảo của giao ước mới tốt hơn. Chương 11 là phòng trưng bày đức tin với các anh hùng đức tin từ Cựu Ước." },
  { title: "Gia-cơ", titleEn: "James", testament: "new", group: "Các Thư Tổng Quát", groupEn: "General Epistles",
    short: "Thư về đức tin thực hành qua việc làm.",
    long: "Thư thực tiễn nhất trong Tân Ước, viết bởi Gia-cơ em Chúa Giê-su. Nhấn mạnh đức tin phải được bày tỏ qua việc làm: kiên nhẫn trong thử thách, kiểm soát lưỡi, khôn ngoan từ trên, không thiên vị người giàu, cầu nguyện cho người bệnh, và chăm sóc kẻ mồ côi và người góa bụa. 'Đức tin không có việc làm là đức tin chết.'" },
  { title: "I Phi-e-rơ", titleEn: "1 Peter", testament: "new", group: "Các Thư Tổng Quát", groupEn: "General Epistles",
    short: "Thư về hy vọng và sự chịu khổ vì Đấng Christ.",
    long: "Thư khích lệ các tín hữu đang chịu bắt bớ rải rác khắp Tiểu Á. Phi-e-rơ nhắc nhở về hy vọng sống qua sự phục sinh, kêu gọi sống thánh khiết như dân tộc được chọn, chịu khổ theo gương Đấng Christ, vâng phục trong các mối quan hệ, và tỉnh thức trước ma quỷ. Sự chịu khổ vì Chúa là phước hạnh và sẽ mang lại vinh hiển." },
  { title: "II Phi-e-rơ", titleEn: "2 Peter", testament: "new", group: "Các Thư Tổng Quát", groupEn: "General Epistles",
    short: "Thư cảnh báo về giáo sư giả và sự tái lâm.",
    long: "Thư cảnh báo về giáo sư giả sẽ lén đưa tà giáo vào, sống buông tuồng, và chế nhạo lời hứa Chúa tái lâm. Phi-e-rơ khuyến khích tăng trưởng trong đức tin và nhân đức, nhắc nhở rằng Chúa không chậm trễ nhưng kiên nhẫn muốn mọi người ăn năn. Ngày của Chúa sẽ đến như kẻ trộm, nên phải sống thánh khiết và mong chờ trời mới đất mới." },
  { title: "I Giăng", titleEn: "1 John", testament: "new", group: "Các Thư Tổng Quát", groupEn: "General Epistles",
    short: "Thư về tình yêu, ánh sáng và sự sống trong Đấng Christ.",
    long: "Thư của sứ đồ Giăng viết để tín hữu biết chắc mình có sự sống đời đời. Ba bằng chứng của sự cứu rỗi thật: tin Chúa Giê-su là Con Đức Chúa Trời đến trong xác thịt (lẽ thật), yêu thương anh em (tình yêu), và sống công bình (sự vâng lời). Đức Chúa Trời là sự sáng và là tình yêu thương, và trong Ngài không có sự tối tăm." },
  { title: "II Giăng", titleEn: "2 John", testament: "new", group: "Các Thư Tổng Quát", groupEn: "General Epistles",
    short: "Thư ngắn về lẽ thật và tình yêu thương.",
    long: "Thư ngắn nhất trong Tân Ước, gửi cho 'bà được chọn và con cái bà' (có thể là một Hội Thánh). Giăng vui mừng vì họ bước đi trong lẽ thật, nhắc lại điều răn yêu thương lẫn nhau, và cảnh báo nghiêm khắc không tiếp đón những kẻ lừa dối phủ nhận Đấng Christ đến trong xác thịt." },
  { title: "III Giăng", titleEn: "3 John", testament: "new", group: "Các Thư Tổng Quát", groupEn: "General Epistles",
    short: "Thư ngắn về lòng hiếu khách và sự trung tín.",
    long: "Thư cá nhân gửi cho Gai-út, khen ngợi lòng hiếu khách của ông đối với các giáo sĩ lưu hành, quở trách Đi-ô-trép vì tham quyền và từ chối tiếp đón anh em, đồng thời ca ngợi Đê-mê-triu có tiếng tốt. Thư cho thấy tầm quan trọng của sự hợp tác, lòng rộng rãi, và tấm gương tốt trong Hội Thánh đầu tiên." },
  { title: "Giu-đe", titleEn: "Jude", testament: "new", group: "Các Thư Tổng Quát", groupEn: "General Epistles",
    short: "Thư cảnh báo về sự bội đạo và kêu gọi giữ đức tin.",
    long: "Thư ngắn nhưng mãnh liệt của Giu-đe, em Chúa Giê-su, kêu gọi tín hữu vì đức tin mà chiến đấu chống lại những kẻ lén lút xâm nhập Hội Thánh, biến ân điển thành cớ buông tuồng. Giu-đe dùng các ví dụ từ Cựu Ước để cảnh báo về hậu quả của sự bội đạo, và kết thúc bằng bài ca tụng vinh hiển về Đấng có thể giữ anh em khỏi vấp ngã." },

  // Tiên Tri / Prophecy
  { title: "Khải-huyền", titleEn: "Revelation", testament: "new", group: "Tiên Tri", groupEn: "Prophecy",
    short: "Sách khải huyền về sự chiến thắng cuối cùng của Đấng Christ.",
    long: "Sách cuối cùng của Kinh Thánh, chứa khải tượng được ban cho sứ đồ Giăng trên đảo Bát-mô. Bắt đầu với bảy thư gửi bảy Hội Thánh tại Tiểu Á, sau đó mở ra cảnh tượng hùng vĩ về ngai Đức Chúa Trời trên trời, bảy ấn, bảy ống loa, bảy bát thạnh nộ, sự sụp đổ của Ba-by-lôn lớn, cuộc chiến cuối cùng, sự phán xét trước ngai trắng lớn, và trời mới đất mới nơi Đức Chúa Trời ở với loài người và lau ráo mọi nước mắt." },
];

const outDir = join(import.meta.dir, "../content/kt");
mkdirSync(outDir, { recursive: true });

let otCount = 0, ntCount = 0;

books.forEach((book, i) => {
  const weight = i + 1;
  const isOT = book.testament === "old";
  const pos = isOT ? ++otCount : ++ntCount;
  const prefix = isOT ? "OT" : "NT";
  const slug = `${prefix.toLowerCase()}${String(pos).padStart(2, "0")}`;
  const content = `---
title: "${book.title}"
titleEn: "${book.titleEn}"
slug: "${slug}"
layout: kt-book
testament: ${book.testament}
group: "${book.group}"
groupEn: "${book.groupEn}"
weight: ${weight}
description: "${book.short}"
---

${book.long}
`;
  writeFileSync(join(outDir, `${slug}.md`), content);
});

console.log(`Generated ${books.length} book files in ${outDir}`);
